/**
 * External 3D avatar models for Loop Kicker Journey (Three.js)
 * Provides the selectable 3D avatars and their procedural textures/materials:
 *  - Aero Wyvern with articulated wings and flight dynamics ('aero_wyvern', default)
 *  - Fuchur / Falkor from Die unendliche Geschichte ('fuchur')
 *  - Boy with Bicycle & E.T. ('et_bike')
 *  - Car from Back to the Future ('delorean')
 *  - UFO from Mars Attacks! ('mars_ufo')
 *  - Paramotor under a Phi Maestro Light 3 paraglider ('paramotor')
 */
window.LoopKickerJourneyAvatarModels = {
    /**
     * Generates a procedural keratin horn & bone texture with annular growth rings
     * and longitudinal bone flutes for horns, osteoderm spines, wing bones, and talons.
     */
    createDragonHornBoneTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        const baseGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        baseGrad.addColorStop(0.0, '#fffbeb');
        baseGrad.addColorStop(0.55, '#fde68a');
        baseGrad.addColorStop(0.85, '#b45309');
        baseGrad.addColorStop(1.0, '#451a03');
        ctx.fillStyle = baseGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Annular keratin growth rings around the horn circumference
        for (let y = 6; y < canvas.height; y += 10) {
            ctx.strokeStyle = (y % 20 === 6)
                ? 'rgba(69, 26, 3, 0.45)'
                : 'rgba(255, 251, 235, 0.42)';
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            for (let x = 0; x <= canvas.width; x += 16) {
                const dy = Math.sin(x * 0.08 + y * 0.15) * 2.0;
                if (x === 0) ctx.moveTo(x, y + dy);
                else ctx.lineTo(x, y + dy);
            }
            ctx.stroke();
        }

        // Longitudinal bone flutes and weathering grooves
        for (let x = 0; x < canvas.width; x += 5) {
            ctx.strokeStyle = (x % 10 === 0)
                ? 'rgba(69, 26, 3, 0.28)'
                : 'rgba(255, 255, 255, 0.20)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x + Math.sin(x * 0.2) * 3, canvas.height);
            ctx.stroke();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2);
        return texture;
    },

    /**
     * Builds a subdivided, aerodynamically cambered 3D wing membrane panel between
     * origin, p1, and p2 with a natural upward airfoil arch, scalloped trailing edge,
     * and full UV coordinates so procedural membrane textures & bump maps render cleanly.
     */
    createCamberedWingPanelGeometry(origin, p1, p2, camberHeight = 0.24, radialSteps = 6, spanSteps = 6) {
        const positions = [];
        const uvs = [];
        const indices = [];

        for (let r = 0; r <= radialSteps; r++) {
            const u = r / radialSteps;
            for (let s = 0; s <= spanSteps; s++) {
                const v = s / spanSteps;
                // Interpolate along the two bounding finger bone spars from origin
                const edge1X = origin.x + (p1.x - origin.x) * u;
                const edge1Y = origin.y + (p1.y - origin.y) * u;
                const edge1Z = origin.z + (p1.z - origin.z) * u;

                const edge2X = origin.x + (p2.x - origin.x) * u;
                const edge2Y = origin.y + (p2.y - origin.y) * u;
                const edge2Z = origin.z + (p2.z - origin.z) * u;

                let vx = edge1X + (edge2X - edge1X) * v;
                let vy = edge1Y + (edge2Y - edge1Y) * v;
                let vz = edge1Z + (edge2Z - edge1Z) * v;

                // Parabolic airfoil camber arch across the membrane web
                const webArc = Math.sin(v * Math.PI) * Math.sin(u * Math.PI * 0.88);
                vy += webArc * camberHeight;

                // Scalloped concave trailing edge between wing finger tips
                const trailingScallop = Math.pow(u, 1.8) * Math.sin(v * Math.PI);
                vz -= trailingScallop * 0.28;

                positions.push(vx, vy, vz);
                uvs.push(u, v);
            }
        }

        const stride = spanSteps + 1;
        for (let r = 0; r < radialSteps; r++) {
            for (let s = 0; s < spanSteps; s++) {
                const a = r * stride + s;
                const b = (r + 1) * stride + s;
                const c = (r + 1) * stride + (s + 1);
                const d = r * stride + (s + 1);
                indices.push(a, b, d);
                indices.push(b, c, d);
            }
        }

        const geo = new THREE.BufferGeometry();
        geo.setIndex(indices);
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geo.computeVertexNormals();
        return geo;
    },

    /**
     * Grayscale overlapping-scale hide texture for the Aero Wyvern. Colour comes from
     * countershaded vertex colours (dark dorsal, pale ventral) so the texture only adds relief.
     */
    createWyvernHideTexture() {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#5a5a58';
        ctx.fillRect(0, 0, size, size);

        const cols = 18;
        const rows = 26;
        const cw = size / cols;
        const rh = size / rows;
        const drawScale = (cx, cy, shade) => {
            const grad = ctx.createRadialGradient(cx, cy - rh * 0.3, cw * 0.06, cx, cy, cw * 0.72);
            grad.addColorStop(0, `rgb(${shade + 62},${shade + 62},${shade + 58})`);
            grad.addColorStop(0.6, `rgb(${shade},${shade},${shade - 4})`);
            grad.addColorStop(1, `rgb(${shade - 52},${shade - 52},${shade - 56})`);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.ellipse(cx, cy, cw * 0.6, rh * 0.82, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(22,22,20,0.5)';
            ctx.lineWidth = 1.1;
            ctx.stroke();
        };
        for (let r = 0; r <= rows; r++) {
            for (let c = 0; c <= cols; c++) {
                const cx = c * cw + (r % 2) * cw * 0.5;
                const cy = r * rh;
                const shade = 118 + Math.floor(Math.random() * 42);
                [-size, 0, size].forEach((ox) => {
                    [-size, 0, size].forEach((oy) => {
                        const x = cx + ox;
                        const y = cy + oy;
                        if (x < -cw || x > size + cw || y < -rh || y > size + rh) return;
                        drawScale(x, y, shade);
                    });
                });
            }
        }
        for (let i = 0; i < 2600; i++) {
            const a = 0.05 + Math.random() * 0.12;
            ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,250,${a})` : `rgba(0,0,0,${a})`;
            ctx.fillRect(Math.random() * size, Math.random() * size, 1.4, 1.4);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2);
        texture.anisotropy = 4;
        return texture;
    },

    /**
     * Warm translucent-looking wing membrane texture with spanwise elastic fibres,
     * branching blood vessels from the leading edge and a darker trailing edge.
     */
    createWyvernMembraneTexture() {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        const grad = ctx.createLinearGradient(0, 0, 0, size);
        grad.addColorStop(0, '#f1dccb');
        grad.addColorStop(0.55, '#e2c2ab');
        grad.addColorStop(1, '#b38a74');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);

        ctx.lineWidth = 1;
        for (let i = 0; i < 150; i++) {
            const y = Math.random() * size;
            ctx.strokeStyle = `rgba(120,70,55,${0.06 + Math.random() * 0.08})`;
            ctx.beginPath();
            ctx.moveTo(0, y);
            for (let x = 0; x <= size; x += 32) {
                ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 4 + (Math.random() - 0.5) * 3);
            }
            ctx.stroke();
        }

        const vein = (x, y, ang, len, width, depth) => {
            if (depth > 4 || len < 8) return;
            const x2 = x + Math.cos(ang) * len;
            const y2 = y + Math.sin(ang) * len;
            const cx = (x + x2) / 2 + (Math.random() - 0.5) * len * 0.3;
            const cy = (y + y2) / 2 + (Math.random() - 0.5) * len * 0.3;
            ctx.strokeStyle = `rgba(110,35,30,${0.55 - depth * 0.08})`;
            ctx.lineWidth = width;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.quadraticCurveTo(cx, cy, x2, y2);
            ctx.stroke();
            vein(x2, y2, ang - 0.25 - Math.random() * 0.35, len * 0.68, width * 0.68, depth + 1);
            vein(x2, y2, ang + 0.25 + Math.random() * 0.35, len * 0.62, width * 0.62, depth + 1);
        };
        for (let i = 0; i < 9; i++) {
            vein(28 + i * 58 + Math.random() * 20, 0, Math.PI / 2 + (Math.random() - 0.5) * 0.4, 120 + Math.random() * 40, 3.2, 0);
        }

        const edge = ctx.createLinearGradient(0, size * 0.8, 0, size);
        edge.addColorStop(0, 'rgba(70,30,25,0)');
        edge.addColorStop(1, 'rgba(70,30,25,0.5)');
        ctx.fillStyle = edge;
        ctx.fillRect(0, size * 0.8, size, size * 0.2);

        const texture = new THREE.CanvasTexture(canvas);
        texture.anisotropy = 4;
        return texture;
    },

    /**
     * Alternate avatar: realistic articulated "Aero Wyvern" (forelimbs are the wings, like bats/pterosaurs).
     * Rig: shoulder -> elbow -> wrist -> 4 jointed wing fingers per side, dynamic membrane mesh rebuilt
     * from the joint positions every frame, 5-segment stabilised neck, 13-segment tail with a diamond
     * tail vane (elevator/rudder), tuckable hind legs. All motion is driven by `updateAeroWyvern`.
     */
    buildAeroWyvern() {
        this.dragonGroup = new THREE.Group();
        this.wyvernHideTexture = this.createWyvernHideTexture();
        this.wyvernMembraneTexture = this.createWyvernMembraneTexture();
        this.wyvernBoneTexture = this.createDragonHornBoneTexture();

        const hideMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            vertexColors: true,
            map: this.wyvernHideTexture,
            bumpMap: this.wyvernHideTexture,
            bumpScale: 0.035,
            roughness: 0.58,
            metalness: 0.06
        });
        const membraneMat = new THREE.MeshStandardMaterial({
            color: 0xa0302a,
            map: this.wyvernMembraneTexture,
            bumpMap: this.wyvernMembraneTexture,
            bumpScale: 0.02,
            roughness: 0.72,
            metalness: 0.0,
            emissive: 0x420a06,
            emissiveIntensity: 0.55,
            side: THREE.DoubleSide
        });
        const boneMat = new THREE.MeshStandardMaterial({ color: 0x3b342c, map: this.wyvernBoneTexture, roughness: 0.5, metalness: 0.05 });
        const hornMat = new THREE.MeshStandardMaterial({ color: 0xd6c8a8, map: this.wyvernBoneTexture, roughness: 0.38, metalness: 0.04 });
        const clawMat = new THREE.MeshStandardMaterial({ color: 0x1b1714, roughness: 0.3, metalness: 0.1 });
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffb21a, emissive: 0xff8a00, emissiveIntensity: 0.9, roughness: 0.15 });
        const pupilMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
        const toothMat = new THREE.MeshStandardMaterial({ color: 0xf1ead8, roughness: 0.3 });

        // Countershading: deep crimson back, scarlet flanks, warm orange-red belly (written as vertex colours)
        const dorsal = new THREE.Color(0x6e1010);
        const flank = new THREE.Color(0xb3261c);
        const ventral = new THREE.Color(0xe08a5a);
        const countershade = (geo) => {
            geo.computeVertexNormals();
            const normals = geo.attributes.normal;
            const colors = new Float32Array(normals.count * 3);
            const c = new THREE.Color();
            for (let i = 0; i < normals.count; i++) {
                const t = THREE.MathUtils.clamp((0.25 - normals.getY(i)) / 1.1, 0, 1);
                if (t < 0.5) c.copy(dorsal).lerp(flank, t * 2);
                else c.copy(flank).lerp(ventral, (t - 0.5) * 2);
                colors[i * 3] = c.r;
                colors[i * 3 + 1] = c.g;
                colors[i * 3 + 2] = c.b;
            }
            geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            return geo;
        };
        const hideEllipsoid = (rx, ry, rz, wSeg = 18, hSeg = 12) => {
            const g = new THREE.SphereGeometry(1, wSeg, hSeg);
            g.scale(rx, ry, rz);
            return countershade(g);
        };
        const ORIGIN = new THREE.Vector3(0, 0, 0);
        const Y_AXIS = new THREE.Vector3(0, 1, 0);
        const V = (x, y, z) => new THREE.Vector3(x, y, z);
        const addBone = (parent, from, to, r0, r1, mat, knob = true) => {
            const dir = new THREE.Vector3().subVectors(to, from);
            const len = dir.length();
            const geo = new THREE.CylinderGeometry(r1, r0, len, 10, 1);
            geo.translate(0, len / 2, 0);
            countershade(geo);
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.copy(from);
            mesh.quaternion.setFromUnitVectors(Y_AXIS, dir.normalize());
            parent.add(mesh);
            if (knob) {
                const k = new THREE.Mesh(countershade(new THREE.SphereGeometry(r0 * 1.2, 10, 8)), mat);
                k.position.copy(from);
                parent.add(k);
            }
            return mesh;
        };
        const taperedTube = (points, radius, endScale = 0.1, tubSeg = 14, radSeg = 8) => {
            const curve = new THREE.CatmullRomCurve3(points);
            const geo = new THREE.TubeGeometry(curve, tubSeg, radius, radSeg, false);
            const pos = geo.attributes.position;
            const center = new THREE.Vector3();
            const v = new THREE.Vector3();
            for (let i = 0; i <= tubSeg; i++) {
                curve.getPointAt(i / tubSeg, center);
                const scale = 1 - (1 - endScale) * (i / tubSeg);
                for (let j = 0; j <= radSeg; j++) {
                    const idx = i * (radSeg + 1) + j;
                    v.fromBufferAttribute(pos, idx).sub(center).multiplyScalar(scale).add(center);
                    pos.setXYZ(idx, v.x, v.y, v.z);
                }
            }
            geo.computeVertexNormals();
            return geo;
        };
        const addSpike = (parent, x, y, z, r, h, tilt = 0.7) => {
            const spike = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), hornMat);
            spike.position.set(x, y, z);
            spike.rotation.x = tilt;
            parent.add(spike);
            return spike;
        };

        // Body pivot carries flap heave on top of the engine-driven heading/pitch/bank of dragonGroup
        const bodyPivot = new THREE.Group();
        this.dragonGroup.add(bodyPivot);

        // 1. Streamlined torso (lathe profile: deep pectoral chest tapering to slim hips)
        const torsoProfile = [
            [0.0, -1.95], [0.22, -1.9], [0.36, -1.62], [0.5, -1.25], [0.6, -0.8], [0.63, -0.3],
            [0.6, 0.25], [0.53, 0.8], [0.45, 1.3], [0.38, 1.75], [0.3, 2.1], [0.0, 2.2]
        ].map(([r, y]) => new THREE.Vector2(r, y));
        const torsoGeo = new THREE.LatheGeometry(torsoProfile, 28);
        torsoGeo.rotateX(Math.PI / 2);
        torsoGeo.scale(1.0, 0.86, 1.0);
        bodyPivot.add(new THREE.Mesh(countershade(torsoGeo), hideMat));

        const keel = new THREE.Mesh(hideEllipsoid(0.4, 0.3, 0.78), hideMat);
        keel.position.set(0, -0.3, -0.75);
        bodyPivot.add(keel);
        [-1, 1].forEach((s) => {
            const pectoral = new THREE.Mesh(hideEllipsoid(0.36, 0.3, 0.55), hideMat);
            pectoral.position.set(s * 0.4, 0.14, -0.95);
            bodyPivot.add(pectoral);
        });
        for (let i = 0; i < 9; i++) {
            const z = -1.55 + i * 0.42;
            const h = 0.26 - Math.abs(i - 3) * 0.02;
            addSpike(bodyPivot, 0, 0.5 - Math.max(0, i - 4) * 0.035, z, 0.05, h, 0.75);
        }

        // 2. Stabilised 5-segment neck held low and level for a streamlined profile
        const neckRoot = new THREE.Group();
        neckRoot.position.set(0, 0.16, -1.7);
        bodyPivot.add(neckRoot);
        const neckLens = [0.46, 0.44, 0.42, 0.4, 0.38];
        const neckRadii = [0.36, 0.31, 0.27, 0.24, 0.215];
        const neckBasePitch = [0.07, 0.03, -0.01, -0.04, -0.05];
        const neckSegs = [];
        let neckParent = neckRoot;
        for (let i = 0; i < neckLens.length; i++) {
            const seg = new THREE.Group();
            seg.rotation.order = 'YXZ';
            if (i > 0) seg.position.set(0, 0, -neckLens[i - 1]);
            seg.rotation.x = neckBasePitch[i];
            seg.userData.basePitch = neckBasePitch[i];
            const mesh = new THREE.Mesh(hideEllipsoid(neckRadii[i], neckRadii[i] * 0.92, neckLens[i] * 0.8), hideMat);
            mesh.position.z = -neckLens[i] * 0.5;
            seg.add(mesh);
            addSpike(seg, 0, neckRadii[i] * 0.88, -neckLens[i] * 0.5, 0.035, 0.16, 0.8);
            neckParent.add(seg);
            neckParent = seg;
            neckSegs.push(seg);
        }

        // 3. Head: cranium, tapered snout, brow ridges, swept-back horns, amber eyes and hinged jaw
        const head = new THREE.Group();
        head.rotation.order = 'YXZ';
        head.position.set(0, 0, -neckLens[neckLens.length - 1]);
        head.userData.basePitch = 0;
        neckParent.add(head);

        const cranium = new THREE.Mesh(hideEllipsoid(0.3, 0.25, 0.36), hideMat);
        cranium.position.set(0, 0.06, -0.22);
        head.add(cranium);
        const snoutGeo = new THREE.CylinderGeometry(0.1, 0.22, 0.9, 16, 1);
        snoutGeo.rotateX(-Math.PI / 2);
        snoutGeo.scale(1, 0.62, 1);
        snoutGeo.translate(0, 0.0, -0.65);
        head.add(new THREE.Mesh(countershade(snoutGeo), hideMat));
        const snoutTip = new THREE.Mesh(hideEllipsoid(0.11, 0.07, 0.13), hideMat);
        snoutTip.position.set(0, 0, -1.1);
        head.add(snoutTip);

        [-1, 1].forEach((s) => {
            const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), pupilMat);
            nostril.position.set(s * 0.06, 0.045, -1.12);
            head.add(nostril);

            const brow = new THREE.Mesh(hideEllipsoid(0.09, 0.06, 0.2), hideMat);
            brow.position.set(s * 0.17, 0.17, -0.38);
            brow.rotation.y = s * 0.2;
            head.add(brow);

            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 10), eyeMat);
            eye.position.set(s * 0.19, 0.1, -0.42);
            head.add(eye);
            const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), pupilMat);
            pupil.scale.set(0.3, 1.0, 0.35);
            pupil.position.set(s * 0.245, 0.1, -0.43);
            head.add(pupil);

            const mainHorn = new THREE.Mesh(taperedTube([
                V(s * 0.14, 0.2, -0.18), V(s * 0.22, 0.3, 0.12), V(s * 0.26, 0.32, 0.5), V(s * 0.24, 0.24, 0.85)
            ], 0.075, 0.08), hornMat);
            head.add(mainHorn);
            const cheekHorn = new THREE.Mesh(taperedTube([
                V(s * 0.24, 0.02, -0.08), V(s * 0.34, 0.02, 0.2), V(s * 0.38, -0.02, 0.45)
            ], 0.04, 0.1, 10, 6), hornMat);
            head.add(cheekHorn);

            for (let k = 0; k < 6; k++) {
                const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.08, 5), toothMat);
                tooth.position.set(s * (0.15 - k * 0.012), -0.1, -0.35 - k * 0.13);
                tooth.rotation.x = Math.PI;
                head.add(tooth);
            }
        });

        // Lower jaw: pivot is turned 180° about Y so the fire-breath code's positive rotation.x opens it downward
        const jawPivot = new THREE.Group();
        jawPivot.rotation.order = 'YXZ';
        jawPivot.rotation.y = Math.PI;
        jawPivot.position.set(0, -0.1, -0.12);
        head.add(jawPivot);
        const jawGeo = new THREE.CylinderGeometry(0.075, 0.19, 0.95, 14, 1);
        jawGeo.rotateX(Math.PI / 2);
        jawGeo.scale(1, 0.42, 1);
        jawGeo.translate(0, -0.03, 0.5);
        jawPivot.add(new THREE.Mesh(countershade(jawGeo), hideMat));
        [-1, 1].forEach((s) => {
            for (let k = 0; k < 5; k++) {
                const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.07, 5), toothMat);
                tooth.position.set(s * (0.12 - k * 0.014), 0.03, 0.3 + k * 0.12);
                jawPivot.add(tooth);
            }
        });
        this.dragonJawGroup = jawPivot;

        // 4. 13-segment tapering tail ending in a diamond tail vane (horizontal stabiliser + small keel)
        const tailRoot = new THREE.Group();
        tailRoot.position.set(0, 0.04, 1.95);
        bodyPivot.add(tailRoot);
        const TAIL_SEGMENTS = 13;
        const tailSegs = [];
        let tailParent = tailRoot;
        let prevTailLen = 0;
        for (let i = 0; i < TAIL_SEGMENTS; i++) {
            const t = i / (TAIL_SEGMENTS - 1);
            const len = 0.64 - 0.024 * i;
            const rad = 0.06 + 0.3 * Math.pow(1 - t, 1.25);
            const seg = new THREE.Group();
            seg.position.set(0, 0, prevTailLen);
            const mesh = new THREE.Mesh(hideEllipsoid(rad, rad * 0.85, len * 0.74, 14, 10), hideMat);
            mesh.position.z = len * 0.5;
            seg.add(mesh);
            if (i < 10) addSpike(seg, 0, rad * 0.8, len * 0.5, 0.03 + 0.04 * (1 - t), 0.14 + 0.12 * (1 - t), 0.95);
            tailParent.add(seg);
            tailParent = seg;
            prevTailLen = len;
            tailSegs.push(seg);
        }
        const tailVane = new THREE.Group();
        tailVane.position.set(0, 0, prevTailLen);
        tailParent.add(tailVane);
        const vaneShape = new THREE.Shape();
        vaneShape.moveTo(0, 0);
        vaneShape.quadraticCurveTo(0.55, 0.35, 0.62, 0.75);
        vaneShape.quadraticCurveTo(0.3, 1.05, 0, 1.45);
        vaneShape.quadraticCurveTo(-0.3, 1.05, -0.62, 0.75);
        vaneShape.quadraticCurveTo(-0.55, 0.35, 0, 0);
        const vaneGeo = new THREE.ShapeGeometry(vaneShape, 10);
        vaneGeo.rotateX(Math.PI / 2);
        tailVane.add(new THREE.Mesh(vaneGeo, membraneMat));
        addBone(tailVane, ORIGIN, V(0, 0, 1.4), 0.045, 0.012, boneMat, false);
        addBone(tailVane, V(0, 0, 0.15), V(0.58, 0, 0.75), 0.025, 0.01, boneMat, false);
        addBone(tailVane, V(0, 0, 0.15), V(-0.58, 0, 0.75), 0.025, 0.01, boneMat, false);
        const keelShape = new THREE.Shape();
        keelShape.moveTo(0, 0);
        keelShape.lineTo(0.85, 0);
        keelShape.quadraticCurveTo(0.45, 0.12, 0.2, 0.3);
        keelShape.lineTo(0, 0);
        const keelGeo = new THREE.ShapeGeometry(keelShape, 6);
        keelGeo.rotateY(-Math.PI / 2);
        tailVane.add(new THREE.Mesh(keelGeo, membraneMat));

        // 5. Hind legs tucked back along the body in flight (lowered like landing gear when gliding near ground)
        const legs = [-1, 1].map((s) => {
            const hip = new THREE.Group();
            hip.position.set(s * 0.36, -0.2, 1.5);
            bodyPivot.add(hip);
            const thigh = new THREE.Mesh(hideEllipsoid(0.17, 0.2, 0.42), hideMat);
            thigh.position.set(0, -0.05, 0.3);
            hip.add(thigh);
            const knee = new THREE.Group();
            knee.position.set(0, -0.08, 0.68);
            hip.add(knee);
            addBone(knee, ORIGIN, V(0, -0.02, 0.62), 0.09, 0.055, hideMat);
            const ankle = new THREE.Group();
            ankle.position.set(0, -0.02, 0.62);
            knee.add(ankle);
            for (let c = -1; c <= 1; c++) {
                const toeEnd = V(c * 0.09, -0.04, 0.32 - Math.abs(c) * 0.06);
                addBone(ankle, ORIGIN, toeEnd, 0.035, 0.022, hideMat);
                const claw = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.12, 6), clawMat);
                claw.position.copy(toeEnd).add(V(0, -0.02, 0.05));
                claw.rotation.x = Math.PI / 2 + 0.4;
                ankle.add(claw);
            }
            return { side: s, hip, knee, ankle };
        });

        // 6. Articulated wings: shoulder -> humerus -> elbow -> forearm -> wrist -> thumb claw + 4 two-jointed fingers
        const FINGER_SPREADS = [0.05, 0.5, 0.96, 1.42];
        const FINGER_LENGTHS = [3.7, 3.2, 2.7, 2.15];
        const buildWing = (s) => {
            const shoulder = new THREE.Group();
            shoulder.rotation.order = 'YZX';
            shoulder.position.set(s * 0.5, 0.36, -0.95);
            bodyPivot.add(shoulder);
            const deltoid = new THREE.Mesh(hideEllipsoid(0.34, 0.26, 0.42), hideMat);
            deltoid.position.set(s * 0.2, 0.02, 0.05);
            shoulder.add(deltoid);

            const H = V(s * 1.5, 0.04, 0.42);
            addBone(shoulder, ORIGIN, H, 0.2, 0.12, hideMat);
            const elbow = new THREE.Group();
            elbow.rotation.order = 'YZX';
            elbow.position.copy(H);
            shoulder.add(elbow);

            const F = V(s * 2.3, 0.02, -0.5);
            addBone(elbow, ORIGIN, F, 0.13, 0.085, hideMat);
            const wrist = new THREE.Group();
            wrist.rotation.order = 'YZX';
            wrist.position.copy(F);
            elbow.add(wrist);
            wrist.add(new THREE.Mesh(countershade(new THREE.SphereGeometry(0.115, 10, 8)), hideMat));

            addBone(wrist, ORIGIN, V(s * 0.12, 0.02, -0.28), 0.045, 0.03, boneMat, false);
            const thumbClaw = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.2, 7), clawMat);
            thumbClaw.position.set(s * 0.14, 0.0, -0.4);
            thumbClaw.rotation.x = -Math.PI / 2 - 0.3;
            wrist.add(thumbClaw);

            const fingers = FINGER_SPREADS.map((phi, k) => {
                const base = new THREE.Group();
                base.rotation.y = -s * phi;
                wrist.add(base);
                const L1 = FINGER_LENGTHS[k] * 0.48;
                const L2 = FINGER_LENGTHS[k] * 0.52;
                addBone(base, ORIGIN, V(s * L1, 0, 0), 0.065, 0.045, boneMat);
                const knuckle = new THREE.Group();
                knuckle.position.set(s * L1, 0, 0);
                base.add(knuckle);
                addBone(knuckle, ORIGIN, V(s * L2, 0, 0), 0.045, 0.014, boneMat);
                const tip = new THREE.Object3D();
                tip.position.set(s * L2, 0, 0);
                knuckle.add(tip);
                return { base, knuckle, tip, spread: phi };
            });
            return { side: s, shoulder, elbow, wrist, fingers, fold: 0, lift: 0.5 };
        };
        const wings = [buildWing(-1), buildWing(1)];

        // 7. Dynamic wing membranes (vertex grid rebuilt each frame from the joint positions)
        const MEMBRANE_GAPS = [3, 6, 4, 4, 4];
        const MEMBRANE_ROWS = 9;
        const membranes = wings.map((wing, idx) => {
            const s = wing.side;
            const shoulderRoot = new THREE.Object3D();
            shoulderRoot.position.set(s * 0.3, 0.42, -1.45);
            bodyPivot.add(shoulderRoot);
            const hipRoot = new THREE.Object3D();
            hipRoot.position.set(s * 0.38, 0.05, 1.55);
            bodyPivot.add(hipRoot);

            const cols = [];
            MEMBRANE_GAPS.forEach((n, g) => {
                for (let k = 0; k < n; k++) cols.push({ g, u: k / n });
            });
            cols.push({ g: MEMBRANE_GAPS.length - 1, u: 1 });

            const vertCount = cols.length * MEMBRANE_ROWS;
            const positions = new Float32Array(vertCount * 3);
            const uvs = new Float32Array(vertCount * 2);
            const indices = [];
            cols.forEach((col, c) => {
                for (let r = 0; r < MEMBRANE_ROWS; r++) {
                    const vi = c * MEMBRANE_ROWS + r;
                    uvs[vi * 2] = c / (cols.length - 1);
                    uvs[vi * 2 + 1] = 1 - r / (MEMBRANE_ROWS - 1);
                    if (c < cols.length - 1 && r < MEMBRANE_ROWS - 1) {
                        const a = vi;
                        const b = vi + MEMBRANE_ROWS;
                        indices.push(a, b, a + 1, b, b + 1, a + 1);
                    }
                }
            });
            const geo = new THREE.BufferGeometry();
            const posAttr = new THREE.BufferAttribute(positions, 3);
            posAttr.setUsage(THREE.DynamicDrawUsage);
            geo.setAttribute('position', posAttr);
            geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
            geo.setIndex(indices);
            const mesh = new THREE.Mesh(geo, membraneMat);
            mesh.frustumCulled = false;
            bodyPivot.add(mesh);

            const mk = () => Array.from({ length: 6 }, () => new THREE.Vector3());
            return {
                side: s,
                mesh,
                geo,
                cols,
                rows: MEMBRANE_ROWS,
                anchors: {
                    shoulderRoot,
                    hipRoot,
                    elbow: wing.elbow,
                    wrist: wing.wrist,
                    ankle: legs[idx].ankle,
                    fingers: wing.fingers
                },
                P: mk(),
                M: mk(),
                Q: mk()
            };
        });

        this.wyvernRig = {
            bodyPivot,
            neckSegs,
            head,
            tailSegs,
            tailState: tailSegs.map(() => ({ yaw: 0, yawVel: 0, pitch: 0, pitchVel: 0 })),
            tailVane,
            legs,
            wings,
            membranes,
            time: 0,
            flapPhase: 0.3,
            tailWave: 0,
            effort: 0,
            dive: 0,
            glide: 1,
            legDrop: 1,
            omega: 0,
            rollRate: 0,
            pitchRate: 0,
            yawAcc: 0,
            prevBodyYawRate: 0,
            prevHeading: null,
            prevRoll: 0,
            prevPitch: 0,
            neckYaw: 0,
            neckRoll: 0,
            neckPitch: 0,
            tmpInv: new THREE.Matrix4(),
            tmp: Array.from({ length: 8 }, () => new THREE.Vector3())
        };

        this.dragonGroup.position.set(0, this.dragonCurrentY, 0);
        this.scene.add(this.dragonGroup);
        window.LoopKickerJourneyAvatarModels.updateAeroWyvern.call(this, 0.016, {});
    },

    /**
     * Per-frame flight dynamics of the Aero Wyvern.
     * - Turn decomposition: the path's yaw rate ω is split into body-frame components
     *   (bodyYawRate = ω·cos(bank), bodyPullRate = −ω·sin(bank) + pitch rate). In a banked
     *   turn most of the curvature lies in the body's pitch plane, so the tail curves toward the
     *   turn centre (in world space) instead of swinging sideways in body space.
     * - Load factor n = 1/cos(bank) increases flap effort, dihedral and wing loading.
     * - Roll control: the wing on the side the body rolls toward reduces angle of attack and partly
     *   folds; the outer wing extends with higher AoA. Inner wing sweeps back slightly in turns.
     * - Flap cycle: asymmetric down/upstroke, pronated extended downstroke, folded supinated upstroke,
     *   hand lags the arm. Diving tucks and sweeps the wings back; gliding holds them extended.
     * - Neck/head gaze stabilisation (counter roll/pitch, look into the turn), tail spring-damper
     *   chain with inertia lag and a slow big-fish undulation, tail vane acts as elevator/rudder.
     */
    updateAeroWyvern(dt, ctx = {}) {
        const rig = this.wyvernRig;
        if (!rig) return;
        const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
        const step = clamp(dt || 0.016, 0.001, 0.05);
        const smooth = (cur, target, rate) => cur + (target - cur) * Math.min(1, step * rate);
        rig.time += step;

        const isPedaling = !!ctx.isPedaling;
        const isMoving = !!ctx.isMovingForward;
        const wattRatio = clamp(ctx.wattRatio || 0, 0, 2.5);
        const roll = ctx.rollAngle || 0;
        const pitch = ctx.pitchAngle || 0;
        const maxRoll = ctx.maxRollAngle || 0.88;
        const vy = ctx.verticalVelocity || 0;
        const hasHeading = typeof ctx.headingAngle === 'number';

        let rawOmega = 0;
        let rawRollRate = 0;
        let rawPitchRate = 0;
        if (hasHeading && rig.prevHeading !== null) {
            rawOmega = clamp((ctx.headingAngle - rig.prevHeading) / step, -2.5, 2.5);
            rawRollRate = clamp((roll - rig.prevRoll) / step, -4, 4);
            rawPitchRate = clamp((pitch - rig.prevPitch) / step, -3, 3);
        }
        rig.prevHeading = hasHeading ? ctx.headingAngle : null;
        rig.prevRoll = roll;
        rig.prevPitch = pitch;
        rig.omega = smooth(rig.omega, rawOmega, 6);
        rig.rollRate = smooth(rig.rollRate, rawRollRate, 8);
        rig.pitchRate = smooth(rig.pitchRate, rawPitchRate, 6);

        const sinR = Math.sin(roll);
        const cosR = Math.cos(roll);
        const bodyYawRate = rig.omega * cosR;
        const bodyPullRate = -rig.omega * sinR + rig.pitchRate;
        rig.yawAcc = smooth(rig.yawAcc, clamp((bodyYawRate - rig.prevBodyYawRate) / step, -6, 6), 5);
        rig.prevBodyYawRate = bodyYawRate;
        const loadFactor = 1 / Math.max(0.5, cosR);
        const bank = clamp(-roll / maxRoll, -1, 1);
        const rollDemand = clamp(-rig.rollRate * 0.8, -1, 1);
        const climb = clamp(vy / 14, -1, 1);

        const effortTarget = isPedaling
            ? clamp(0.3 + wattRatio * 0.55 + Math.max(0, climb) * 0.45 + (loadFactor - 1) * 0.7, 0.15, 1.6)
            : 0;
        rig.effort = smooth(rig.effort, effortTarget, 2.2);
        rig.dive = smooth(rig.dive, isPedaling ? clamp((-climb - 0.2) * 1.1, 0, 0.7) : 0, 2.0);
        rig.legDrop = smooth(rig.legDrop, isPedaling ? 0 : 1, 1.6);
        rig.glide = smooth(rig.glide, isPedaling ? 0 : 1, 1.5);

        // Asymmetric flap cycle (downstroke ~57% of the period)
        const freqHz = 0.75 + 0.8 * rig.effort;
        rig.flapPhase = (rig.flapPhase + step * freqHz) % 1;
        const amp = Math.min(0.95, (0.16 + 0.5 * rig.effort) * (1 - rig.dive * 0.9)) * (1 - rig.glide);
        const p = rig.flapPhase;
        const DOWN = 0.57;
        let stroke;
        let strokeVel;
        let down = 0;
        let upFold = 0;
        if (p < DOWN) {
            const q = p / DOWN;
            stroke = Math.cos(Math.PI * q);
            strokeVel = -Math.sin(Math.PI * q);
            down = -strokeVel;
        } else {
            const q = (p - DOWN) / (1 - DOWN);
            stroke = -Math.cos(Math.PI * q);
            strokeVel = Math.sin(Math.PI * q);
            upFold = strokeVel;
        }

        const glideTrim = rig.glide * 0.03 + (1 - Math.min(1, rig.effort)) * 0.015;
        rig.wings.forEach((w) => {
            const s = w.side;
            const inner = clamp(s * bank, -1, 1);
            const rollToward = clamp(s * rollDemand, -1, 1);
            const sideAmp = amp * clamp(1 - 0.2 * inner - 0.3 * rollToward, 0.45, 1.5);
            const trim = Math.sin(rig.time * 0.9 + s * 1.3) * glideTrim;
            const dihedral = 0.08 + (loadFactor - 1) * 0.22 + rig.dive * 0.22 + rig.glide * 0.06 + trim;
            const elev = dihedral + sideAmp * stroke + 0.06 * sideAmp;
            const sweep = 0.1 * down * sideAmp - 0.22 * upFold * sideAmp - 0.6 * rig.dive
                + 0.08 * Math.max(0, climb) * (1 - rig.glide) - 0.1 * Math.max(0, inner) + 0.04 * rig.glide;
            const aoa = 0.05 + (loadFactor - 1) * 0.12 + 0.07 * Math.max(0, climb) - 0.06 * rig.dive
                - 0.16 * rollToward - 0.12 * down * sideAmp + 0.2 * upFold * sideAmp + 0.04 * rig.glide;
            const fold = clamp(
                0.8 * upFold * Math.min(1, sideAmp / 0.5) + rig.dive * 0.75
                    + Math.max(0, inner) * 0.15 + Math.max(0, rollToward) * 0.1,
                0,
                0.95
            );
            w.fold = fold;
            w.shoulder.rotation.set(aoa, s * sweep, s * elev);
            // Whip-like bending: elbow and hand lag the arm, so the wing curves against the stroke direction
            w.elbow.rotation.set(0, s * fold * 0.8, s * (-0.4 * strokeVel * sideAmp - 0.03));
            w.wrist.rotation.set(
                -0.05 - 0.14 * down * sideAmp + 0.22 * upFold * sideAmp - 0.1 * rollToward,
                -s * fold * 1.05,
                s * (-0.62 * strokeVel * sideAmp + 0.05 + (loadFactor - 1) * 0.1)
            );
            w.fingers.forEach((f, k) => {
                const flex = 0.8 + 0.15 * k;
                f.base.rotation.y = -s * f.spread * (1 - 0.55 * fold);
                f.knuckle.rotation.z = s * flex * (-0.05 - 0.2 * down * sideAmp + 0.16 * upFold * sideAmp);
            });
            w.lift = clamp(
                0.55 + 1.1 * down * sideAmp + 0.35 * (loadFactor - 1) - 0.9 * upFold * sideAmp - 0.4 * rig.dive - 0.3 * rollToward,
                -0.4,
                1.6
            );
        });

        // Body heave: lift peaks mid-downstroke, the body rises toward the end of it
        const heave = -0.07 * amp * stroke + Math.sin(rig.time * 1.4) * 0.03 * rig.glide;
        rig.bodyPivot.position.y = heave;
        rig.bodyPivot.rotation.x = 0.03 * amp * strokeVel;

        // Neck & head: keep gaze level (counter roll/pitch), look into the turn, absorb heave
        rig.neckYaw = smooth(rig.neckYaw, -(0.5 * bank + 0.17 * bodyYawRate), 4);
        rig.neckRoll = smooth(rig.neckRoll, -0.78 * roll, 5);
        rig.neckPitch = smooth(rig.neckPitch, -0.62 * pitch + 0.06 * climb, 5);
        const NECK_WEIGHTS = [0.08, 0.12, 0.15, 0.17, 0.18];
        const neckSway = 0.012 * amp * Math.sin(2 * Math.PI * p);
        rig.neckSegs.forEach((seg, i) => {
            const wgt = NECK_WEIGHTS[i] || 0.15;
            seg.rotation.set(
                seg.userData.basePitch + rig.neckPitch * wgt + (i === 0 ? -heave * 0.45 : 0),
                rig.neckYaw * wgt + neckSway,
                rig.neckRoll * wgt
            );
        });
        rig.head.rotation.set(rig.neckPitch * 0.3 + heave * 0.45, rig.neckYaw * 0.3 - neckSway * 2, rig.neckRoll * 0.3);

        // Tail: follows the curved path (body-frame curvature), lags by inertia, slow fish-like undulation
        const N = rig.tailSegs.length;
        rig.tailWave += step * (isMoving ? 1.1 + 0.5 * Math.min(1.5, wattRatio) : 0.7);
        const waveScale = (isMoving ? 1 : 0.7) * (1 - 0.5 * Math.abs(bank));
        rig.tailSegs.forEach((seg, i) => {
            const w = (i + 1) / N;
            const st = rig.tailState[i];
            const followYaw = clamp(0.07 * bodyYawRate * (0.55 + 0.9 * w), -0.2, 0.2);
            const inertiaYaw = -0.022 * rig.yawAcc * w;
            const fishWave = Math.sin(rig.tailWave - i * 0.42) * (0.008 + 0.03 * Math.pow(w, 1.6)) * waveScale;
            const yawTarget = followYaw + inertiaYaw + fishWave;
            const followPitch = clamp(-0.06 * bodyPullRate * (0.55 + 0.9 * w), -0.18, 0.18);
            const heaveWave = 0.05 * amp * Math.cos(2 * Math.PI * p - i * 0.38) * w;
            const droop = 0.012 * (1 - Math.min(1, rig.effort)) * (isMoving ? 0.4 : 1);
            const pitchTarget = followPitch + heaveWave + droop;
            const k = 70 * (1 - 0.6 * w);
            const c = 1.5 * Math.sqrt(k);
            st.yawVel += ((yawTarget - st.yaw) * k - st.yawVel * c) * step;
            st.yaw += st.yawVel * step;
            st.pitchVel += ((pitchTarget - st.pitch) * k - st.pitchVel * c) * step;
            st.pitch += st.pitchVel * step;
            seg.rotation.set(st.pitch, st.yaw, -roll * 0.05 * w);
        });
        const pullDemand = clamp(bodyPullRate * 0.7 + climb * 0.5, -1, 1);
        rig.tailVane.rotation.set(-0.28 * pullDemand, 0, -0.35 * roll + 0.25 * rollDemand);
        rig.tailVane.scale.x = clamp(1 + 0.35 * Math.abs(bank) + 0.25 * Math.max(0, climb) + 0.3 * rig.glide - 0.35 * rig.dive, 0.6, 1.6);

        // Hind legs: tucked in powered flight, lowered when gliding near the ground
        rig.legs.forEach((leg) => {
            leg.hip.rotation.set(0.22 + rig.legDrop * 0.95 - rig.dive * 0.1, 0, leg.side * (0.05 + rig.legDrop * 0.12));
            leg.knee.rotation.x = -0.25 - rig.legDrop * 0.85;
            leg.ankle.rotation.x = 0.1 + rig.legDrop * 0.5;
        });

        this.dragonGroup.updateMatrixWorld(true);
        rig.tmpInv.copy(rig.bodyPivot.matrixWorld).invert();
        rig.membranes.forEach((mem, idx) => {
            window.LoopKickerJourneyAvatarModels.updateWyvernMembrane(rig, mem, rig.wings[idx].lift);
        });
    },

    /**
     * Rebuilds one wing membrane from the current joint positions (in bodyPivot space).
     * Chords: [body flank], [elbow/propatagium -> ankle], then fan chords along fingers 4..1
     * (quadratic through each knuckle). Membrane billows along its normal with the current lift
     * and the free trailing edge is scalloped between the finger tips.
     */
    updateWyvernMembrane(rig, mem, lift) {
        const SCALLOP = [0.02, 0.17, 0.2, 0.18, 0.13];
        const BILLOW = [0.5, 1.0, 0.8, 0.8, 0.7];
        const A = mem.anchors;
        const P = mem.P;
        const M = mem.M;
        const Q = mem.Q;
        const s = mem.side;
        const inv = rig.tmpInv;
        const [elbowPos, a, b, pt, pa, qa, chordDir, nrm] = rig.tmp;
        const get = (obj, out) => out.setFromMatrixPosition(obj.matrixWorld).applyMatrix4(inv);

        get(A.shoulderRoot, P[0]);
        get(A.hipRoot, Q[0]);
        M[0].lerpVectors(P[0], Q[0], 0.5);
        M[0].x += s * 0.05;
        get(A.elbow, elbowPos);
        get(A.wrist, P[2]);
        P[1].lerpVectors(P[0], P[2], 0.5).lerp(elbowPos, 0.45);
        get(A.ankle, Q[1]);
        M[1].lerpVectors(P[1], Q[1], 0.5);
        for (let k = 0; k < 4; k++) {
            const f = A.fingers[3 - k];
            if (k > 0) P[2 + k].copy(P[2]);
            get(f.knuckle, M[2 + k]);
            get(f.tip, Q[2 + k]);
        }

        const quad = (p0, m0, q0, v, out) => {
            const w0 = 2 * v * v - 3 * v + 1;
            const w1 = -4 * v * v + 4 * v;
            const w2 = 2 * v * v - v;
            return out.set(
                p0.x * w0 + m0.x * w1 + q0.x * w2,
                p0.y * w0 + m0.y * w1 + q0.y * w2,
                p0.z * w0 + m0.z * w1 + q0.z * w2
            );
        };

        const arr = mem.geo.attributes.position.array;
        let ptr = 0;
        mem.cols.forEach((col) => {
            const g = col.g;
            const u = col.u;
            const su = Math.sin(Math.PI * u);
            for (let r = 0; r < mem.rows; r++) {
                const v = r / (mem.rows - 1);
                const vEff = v * (1 - SCALLOP[g] * su * v);
                quad(P[g], M[g], Q[g], vEff, a);
                quad(P[g + 1], M[g + 1], Q[g + 1], vEff, b);
                pt.lerpVectors(a, b, u);
                if (su > 0.001 && r > 0 && r < mem.rows - 1) {
                    pa.lerpVectors(P[g], P[g + 1], u);
                    qa.lerpVectors(Q[g], Q[g + 1], u);
                    chordDir.subVectors(qa, pa);
                    b.sub(a);
                    nrm.crossVectors(chordDir, b).multiplyScalar(s);
                    const nl = nrm.length();
                    if (nl > 1e-6) {
                        const mag = lift * BILLOW[g] * su * Math.sin(Math.PI * vEff) * chordDir.length() * 0.09;
                        pt.addScaledVector(nrm, mag / nl);
                    }
                }
                arr[ptr++] = pt.x;
                arr[ptr++] = pt.y;
                arr[ptr++] = pt.z;
            }
        });
        mem.geo.attributes.position.needsUpdate = true;
        mem.geo.computeVertexNormals();
    },

    /**
     * Creates the shared flight-state record used by the per-avatar dynamics (turn rate, roll/pitch rates, effort).
     */
    createAvatarFlightState(extra = {}) {
        return Object.assign({
            time: 0,
            prevHeading: null,
            prevRoll: 0,
            prevPitch: 0,
            omega: 0,
            rollRate: 0,
            pitchRate: 0,
            yawAcc: 0,
            prevBodyYawRate: 0,
            effort: 0,
            active: 0
        }, extra);
    },

    /**
     * Shared flight-state tracker: derives turn rate, body-frame yaw/pull rates, load factor and effort
     * from the engine's heading/roll/pitch (same coordinated-turn math as the Aero Wyvern).
     */
    trackAvatarFlightState(rig, dt, ctx = {}) {
        const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
        const step = clamp(dt || 0.016, 0.001, 0.05);
        const smooth = (cur, target, rate) => cur + (target - cur) * Math.min(1, step * rate);
        // Semi-implicit spring-damper on rig[key] (natural frequency w0 rad/s, damping ratio zeta)
        const spring = (key, target, w0, zeta) => {
            const vKey = key + 'Vel';
            rig[vKey] = (rig[vKey] || 0) + (w0 * w0 * (target - (rig[key] || 0)) - 2 * zeta * w0 * (rig[vKey] || 0)) * step;
            rig[key] = (rig[key] || 0) + rig[vKey] * step;
            return rig[key];
        };
        rig.time += step;

        const isPedaling = !!ctx.isPedaling;
        const wattRatio = clamp(ctx.wattRatio || 0, 0, 2.5);
        const roll = ctx.rollAngle || 0;
        const pitch = ctx.pitchAngle || 0;
        const maxRoll = ctx.maxRollAngle || 0.88;
        const hasHeading = typeof ctx.headingAngle === 'number';

        let rawOmega = 0;
        let rawRollRate = 0;
        let rawPitchRate = 0;
        if (hasHeading && rig.prevHeading !== null) {
            rawOmega = clamp((ctx.headingAngle - rig.prevHeading) / step, -2.5, 2.5);
            rawRollRate = clamp((roll - rig.prevRoll) / step, -4, 4);
            rawPitchRate = clamp((pitch - rig.prevPitch) / step, -3, 3);
        }
        rig.prevHeading = hasHeading ? ctx.headingAngle : null;
        rig.prevRoll = roll;
        rig.prevPitch = pitch;
        rig.omega = smooth(rig.omega, rawOmega, 6);
        rig.rollRate = smooth(rig.rollRate, rawRollRate, 8);
        rig.pitchRate = smooth(rig.pitchRate, rawPitchRate, 6);

        const sinR = Math.sin(roll);
        const cosR = Math.cos(roll);
        const bodyYawRate = rig.omega * cosR;
        const bodyPullRate = -rig.omega * sinR + rig.pitchRate;
        rig.yawAcc = smooth(rig.yawAcc, clamp((bodyYawRate - rig.prevBodyYawRate) / step, -6, 6), 5);
        rig.prevBodyYawRate = bodyYawRate;
        const loadFactor = 1 / Math.max(0.5, cosR);
        const climb = clamp((ctx.verticalVelocity || 0) / 14, -1, 1);

        const effortTarget = isPedaling
            ? clamp(0.3 + wattRatio * 0.55 + Math.max(0, climb) * 0.45 + (loadFactor - 1) * 0.7, 0.15, 1.6)
            : 0;
        rig.effort = smooth(rig.effort, effortTarget, 2.2);
        rig.active = smooth(rig.active, isPedaling ? 1 : 0, 1.5);

        return {
            step, clamp, smooth, spring,
            isPedaling, wattRatio, roll, pitch, maxRoll,
            bodyYawRate, bodyPullRate, loadFactor, climb,
            bank: clamp(-roll / maxRoll, -1, 1),
            rollDemand: clamp(-rig.rollRate * 0.8, -1, 1),
            yawN: clamp(bodyYawRate / 1.15, -1.5, 1.5)
        };
    },

    /**
     * Dispatches the per-avatar flight dynamics; runs after the generic watt animation and overrides it.
     */
    updateAvatarDynamics(dt, ctx = {}) {
        const M = window.LoopKickerJourneyAvatarModels;
        if (this.wyvernRig) {
            this.updateAeroWyvern(dt, ctx);
        } else if (this.fuchurRig) {
            M.updateFuchurDynamics.call(this, dt, ctx);
        } else if (this.etBikeRig) {
            M.updateEtBikeDynamics.call(this, dt, ctx);
        } else if (this.deloreanRig) {
            M.updateDeLoreanDynamics.call(this, dt, ctx);
        } else if (this.ufoRig) {
            M.updateMarsUfoDynamics.call(this, dt, ctx);
        } else if (this.paramotorRig) {
            M.updateParamotorDynamics.call(this, dt, ctx);
        }
    },

    /**
     * Fuchur luckdragon dynamics: the long body follows the curved flight path (front reacts fast, the tail
     * lags on an underdamped spring so it swings through on turn exit), a slow dolphin-like travelling wave
     * runs from neck to tail plume, the head is gaze-stabilised and looks into the turn, the glide plumes
     * row with the body wave and act as ailerons, ears/whiskers stream in the airflow and legs tuck back.
     */
    updateFuchurDynamics(dt, ctx = {}) {
        const rig = this.fuchurRig;
        if (!rig) return;
        const f = window.LoopKickerJourneyAvatarModels.trackAvatarFlightState(rig, dt, ctx);
        const { step, clamp, smooth } = f;
        // Exact circular-arc offsets for a beam of length d with curvature k: [lateral, along-axis shortening]
        const arc = (k, d) => (Math.abs(k) < 1e-5 ? [k * d * d * 0.5, 0] : [(1 - Math.cos(k * d)) / k, Math.sin(k * d) / k - d]);

        const kTarget = clamp(0.05 * f.bodyYawRate, -0.075, 0.075);
        rig.kFront = smooth(rig.kFront, kTarget, 6);
        const kTail = clamp(f.spring('kTail', kTarget, 3.6, 0.42), -0.1, 0.1);
        rig.kPitch = smooth(rig.kPitch, clamp(0.03 * f.bodyPullRate, -0.05, 0.05), 4);

        rig.swim = smooth(rig.swim, f.isPedaling ? 1 : 0, 1.2);
        rig.swimPhase = (rig.swimPhase + step * (0.32 + 0.3 * rig.effort)) % 1;
        const ph = rig.swimPhase * Math.PI * 2;
        const amp = rig.swim * (0.2 + 0.26 * Math.min(1.2, rig.effort)) * (1 - 0.4 * Math.min(1, Math.abs(f.yawN)));
        const waveK = (Math.PI * 2) / 10.5;

        // Neck: bends into the turn (front curvature) with a small counter-wave so the head stays calm
        const neckAmp = amp * 0.1;
        rig.neck.forEach((n, i) => {
            const [lx, lz] = arc(rig.kFront, n.d);
            const [ly, lz2] = arc(rig.kPitch, n.d);
            n.obj.position.set(n.base.x + lx, n.base.y + ly + neckAmp * Math.sin(ph + waveK * n.d), n.base.z - lz - lz2);
            n.obj.rotation.y = -rig.kFront * n.d;
            n.obj.rotation.x = n.baseRotX + rig.kPitch * n.d;
            n.obj.rotation.z = -f.roll * 0.08 * (i + 1);
        });

        // Head: follows the neck arc, looks into the turn, counters roll/pitch (gaze stabilisation)
        const h = rig.head;
        if (h) {
            const [hx, hz] = arc(rig.kFront, h.d);
            const [hy, hz2] = arc(rig.kPitch, h.d);
            h.obj.position.set(h.base.x + hx, h.base.y + hy + neckAmp * 1.2 * Math.sin(ph + waveK * h.d), h.base.z - hz - hz2);
            h.obj.rotation.y = -rig.kFront * h.d - 0.22 * f.yawN;
            h.obj.rotation.x = h.baseRotX + rig.kPitch * h.d * 0.5 - f.pitch * 0.35 + 0.1 * f.climb;
            h.obj.rotation.z = -f.roll * 0.4;
        }

        // Tail: eel-like (anguilliform) undulation. A travelling wave of heading angles (~1.5 wavelengths along the
        // tail, growing toward the plume) is integrated segment by segment, so the chain bends freely but never stretches.
        // It never fully stops: even when idle the tail keeps slowly snaking as if suspended in water.
        const dMax = rig.tail.length ? rig.tail[rig.tail.length - 1].d : 1;
        const eelDrive = 0.45 + 0.55 * rig.swim * Math.min(1.3, 0.4 + rig.effort);
        rig.eelPhase = ((rig.eelPhase || 0) + step * (0.22 + 0.38 * rig.swim * (0.5 + rig.effort))) % 1;
        const eph = rig.eelPhase * Math.PI * 2;
        const eelK = (Math.PI * 2) / (dMax / 1.5);
        const latAmp = 0.58 * eelDrive * (1 - 0.35 * Math.min(1, Math.abs(f.yawN)));
        const vertAmp = 0.14 * eelDrive + 0.08 * amp;
        let px = 0, py = 0, pz = 0, prevYaw = 0, prevPitch = 0;
        rig.tail.forEach((t, i) => {
            const u = t.d / dMax;
            const env = 0.12 + 0.88 * Math.pow(u, 1.1);
            const theta = eph - eelK * t.d;
            const yaw = kTail * t.d + latAmp * env * Math.sin(theta);
            const prev = i > 0 ? rig.tail[i - 1] : null;
            const basePitch = prev ? Math.atan2(t.base.y - prev.base.y, t.base.z - prev.base.z) : 0;
            const pitch = rig.kPitch * t.d + basePitch + vertAmp * env * Math.sin(theta + 1.4);
            if (!prev) {
                px = t.base.x; py = t.base.y; pz = t.base.z;
            } else {
                const segLen = Math.hypot(t.base.y - prev.base.y, t.base.z - prev.base.z);
                const my = 0.5 * (yaw + prevYaw), mp = 0.5 * (pitch + prevPitch);
                px += segLen * Math.sin(my);
                py += segLen * Math.cos(my) * Math.sin(mp);
                pz += segLen * Math.cos(my) * Math.cos(mp);
            }
            prevYaw = yaw;
            prevPitch = pitch;
            t.obj.position.set(px, py, pz);
            t.obj.rotation.y = yaw;
            t.obj.rotation.x = -pitch;
            // Body rolls slightly with the sideways sweep, like an eel twisting through the water
            t.obj.rotation.z = clamp(-rig.rollRate * 0.03 * (1 + t.i * 0.25) + 0.25 * latAmp * env * Math.cos(theta), -0.5, 0.5);
        });

        // Glide plumes: row with the body wave, aileron on roll demand, flex up under g-load, sweep back with speed/dive
        const sweep = 0.12 * rig.effort + 0.22 * Math.max(0, -f.climb);
        const dihedral = 0.06 + 0.06 * (f.loadFactor - 1);
        rig.plumes.forEach((p) => {
            const s = p.side;
            const wave = Math.sin(ph + 0.6) * (0.1 + 0.22 * rig.effort) * rig.swim;
            const tipWave = Math.sin(ph - 0.2) * (0.14 + 0.25 * rig.effort) * rig.swim;
            p.pivot.rotation.z = s * (wave + dihedral + s * f.rollDemand * 0.28);
            p.pivot.rotation.y = p.baseRotY - s * sweep;
            if (p.tip) p.tip.rotation.z = s * (tipWave + dihedral * 1.5 + s * f.rollDemand * 0.18);
        });

        // Ears & whiskers stream back in the airflow, swing to the outside of turns, outer ear lifts
        rig.ears.forEach((e) => {
            const s = e.side;
            const flutter = Math.sin(rig.time * 7.3 + s) * 0.04 * (0.5 + rig.effort);
            const outerLift = 0.16 * Math.max(0, -s * f.yawN);
            e.obj.rotation.x = -(0.08 + 0.12 * rig.effort) - 0.1 * Math.max(0, -f.climb) + 0.08 * Math.max(0, f.climb) + flutter;
            e.obj.rotation.y = -0.18 * f.yawN;
            e.obj.rotation.z = -s * outerLift + flutter * 0.6;
        });
        rig.whiskers.forEach((w) => {
            w.obj.rotation.y = -0.3 * f.yawN + Math.sin(rig.time * 1.7 + w.side) * 0.06;
            w.obj.rotation.z = Math.sin(rig.time * 2.3 + w.side * 1.3) * 0.08 * (0.4 + rig.effort);
        });

        // Legs tuck back with speed and paddle slowly with the swimming wave
        rig.forelegs.forEach((leg, i) => {
            leg.rotation.x = -(0.12 + 0.34 * rig.effort) + Math.sin(ph + i * Math.PI) * 0.12 * rig.swim;
        });
        rig.hindlegs.forEach((leg, i) => {
            leg.rotation.x = -(0.18 + 0.4 * rig.effort) + Math.sin(ph - 1.2 + i * Math.PI) * 0.1 * rig.swim;
        });
    },

    /**
     * E.T. bike dynamics: the bike rocks with the crank (out of the saddle when sprinting or climbing) while
     * Elliott counter-sways and leans into turns, the frame lags/overshoots roll and pitch changes, wheels
     * freewheel when coasting and E.T. looks into the turn and up on climbs while stabilising his gaze.
     */
    updateEtBikeDynamics(dt, ctx = {}) {
        const rig = this.etBikeRig;
        if (!rig) return;
        const f = window.LoopKickerJourneyAvatarModels.trackAvatarFlightState(rig, dt, ctx);
        const { step, clamp, smooth } = f;
        const parts = this.avatarAnimParts || {};
        const crank = parts.crankPivot ? parts.crankPivot.rotation.x : 0;

        rig.standing = smooth(rig.standing, f.isPedaling ? clamp((rig.effort - 0.75) * 1.2 + Math.max(0, f.climb) * 0.9, 0, 1) : 0, 2);
        const rock = Math.sin(crank) * (0.025 + 0.08 * rig.standing) * rig.active;
        const rollLag = f.spring('rollLag', clamp(-0.06 * rig.rollRate, -0.12, 0.12), 7, 0.3);
        const pitchLag = f.spring('pitchLag', clamp(-0.05 * rig.pitchRate, -0.08, 0.08), 6, 0.35);

        rig.bikeRoot.rotation.z = rock + rollLag;
        rig.bikeRoot.rotation.x = pitchLag;
        rig.bikeRoot.position.y = 0.04 * rig.standing * Math.abs(Math.cos(crank));

        if (rig.riderTorso) {
            rig.riderTorso.rotation.z = clamp(-rock * 0.9 - 0.06 * f.bank, -0.09, 0.09);
            rig.riderTorso.rotation.x = rig.torsoBaseRotX - 0.06 * rig.effort - 0.04 * rig.standing;
        }

        if (rig.etHead) {
            rig.etHead.position.y = rig.etHeadBaseY + 0.02 * Math.sin(rig.time * 2.4);
            rig.etHead.rotation.y = -0.45 * f.yawN + 0.12 * Math.sin(rig.time * 0.45) * (1 - Math.min(1, Math.abs(f.yawN)));
            rig.etHead.rotation.x = -0.25 * f.pitch + 0.3 * f.climb;
            rig.etHead.rotation.z = -f.roll * 0.5 - rig.bikeRoot.rotation.z;
        }

        // Freewheel: wheels keep rolling and slowly spin down when no watts are pedaled
        if (f.isPedaling) {
            rig.wheelSpin = 1.35 * (3.0 + clamp(f.wattRatio, 0.05, 2.5) * 9.5);
        } else {
            rig.wheelSpin *= Math.exp(-0.3 * step);
            if (rig.frontWheel) rig.frontWheel.rotation.x -= rig.wheelSpin * step;
            if (rig.rearWheel) rig.rearWheel.rotation.x -= rig.wheelSpin * step;
        }
    },

    /**
     * DeLorean hover dynamics: spring-damped body roll/pitch overshoot, slight oversteer drift into turns,
     * hover bob, hover wheels vectoring thrust (centripetal + differential yaw, forward with effort)
     * and thruster/vent glow following effort and climb.
     */
    updateDeLoreanDynamics(dt, ctx = {}) {
        const rig = this.deloreanRig;
        if (!rig) return;
        const f = window.LoopKickerJourneyAvatarModels.trackAvatarFlightState(rig, dt, ctx);
        const { clamp, smooth } = f;
        rig.effortSlow = smooth(rig.effortSlow, rig.effort, 0.8);

        const car = rig.carGroup;
        car.rotation.z = f.spring('bodyRoll', clamp(-0.08 * rig.rollRate, -0.14, 0.14), 6.5, 0.3);
        car.rotation.x = f.spring('bodyPitch', clamp(0.08 * (rig.effort - rig.effortSlow) - 0.06 * rig.pitchRate, -0.1, 0.1), 5.5, 0.35);
        car.rotation.y = f.spring('drift', clamp(-0.14 * f.yawN, -0.18, 0.18), 3.5, 0.6);
        car.position.y = rig.baseY + (0.05 * Math.sin(rig.time * 1.7) + 0.025 * Math.sin(rig.time * 2.9 + 1)) * (0.6 + 0.4 * rig.active);

        const forwardTilt = -(0.06 + 0.2 * rig.effort) * (1 - 0.5 * Math.max(0, f.climb));
        rig.wheels.forEach((w) => {
            const yawVector = 0.16 * f.yawN + (w.front ? 1 : -1) * clamp(0.12 * rig.yawAcc, -0.18, 0.18);
            w.obj.rotation.z = -yawVector;
            w.obj.rotation.x = smooth(w.obj.rotation.x, forwardTilt, 4);
        });

        const flicker = Math.sin(rig.time * 23) * 0.04 + Math.sin(rig.time * 37) * 0.03;
        if (rig.thrusterGlowMat) {
            rig.thrusterGlowMat.opacity = clamp(0.45 + 0.4 * rig.effort + 0.15 * Math.max(0, f.climb) + flicker, 0.3, 1);
        }
        const ventScale = clamp(0.75 + 0.45 * rig.effort + 0.2 * Math.max(0, f.climb) + flicker, 0.6, 1.5);
        rig.rearVentClusters.forEach((vc) => vc.scale.set(ventScale, ventScale, ventScale));
    },

    /**
     * Mars UFO dynamics: gyroscopic saucer with spring-damped tilt and precession coupling (roll input nudges
     * pitch and vice versa), extra bank into turns, nose-down thrust tilt with effort, spin-imbalance wobble,
     * idle disc spin when coasting and a gyro-stabilised pilot who looks into the turn.
     */
    updateMarsUfoDynamics(dt, ctx = {}) {
        const rig = this.ufoRig;
        if (!rig) return;
        const f = window.LoopKickerJourneyAvatarModels.trackAvatarFlightState(rig, dt, ctx);
        const { step, clamp, smooth } = f;

        if (f.isPedaling) {
            rig.spinRate = 2.2 + clamp(f.wattRatio, 0.05, 2.5) * 4.5;
        } else {
            rig.spinRate = smooth(rig.spinRate, 0.9, 0.8);
            rig.disc.rotation.y += rig.spinRate * step;
        }

        const tz = f.spring('tiltZ', clamp(-0.1 * rig.rollRate - 0.12 * f.yawN - 0.04 * rig.pitchRate, -0.35, 0.35), 5.5, 0.18);
        const tx = f.spring('tiltX', clamp(-0.03 - 0.12 * rig.effort * (1 - 0.5 * Math.max(0, f.climb)) - 0.08 * rig.pitchRate + 0.04 * rig.rollRate, -0.35, 0.2), 5, 0.22);
        const wob = 0.018 * (0.4 + rig.effort);
        const spinAngle = rig.disc.rotation.y;
        rig.root.rotation.x = tx + wob * Math.sin(spinAngle);
        rig.root.rotation.z = tz + wob * Math.cos(spinAngle);
        rig.root.position.y = 0.08 * Math.sin(rig.time * 1.3) + 0.03 * Math.sin(rig.time * 3.1);

        if (rig.pilot) {
            rig.pilot.position.set(rig.pilotBase.x, rig.pilotBase.y + 0.02 * Math.sin(rig.time * 2.0), rig.pilotBase.z);
            rig.pilot.rotation.z = -(f.roll + tz) * 0.55;
            rig.pilot.rotation.x = -(f.pitch + tx) * 0.5;
            rig.pilot.rotation.y = -0.5 * f.yawN + 0.25 * Math.sin(rig.time * 0.35) * (1 - Math.min(1, Math.abs(f.yawN)));
        }
    },

    /**
     * Resets animation references before building a new avatar figure.
     */
    resetAvatarAnimationParts() {
        this.leftWingPivot = null;
        this.rightWingPivot = null;
        this.leftOuterWingPivot = null;
        this.rightOuterWingPivot = null;
        this.dragonHeadGroup = null;
        this.dragonJawGroup = null;
        this.neckSegments = [];
        this.tailSegments = [];
        this.avatarAnimParts = {};
        this.wyvernRig = null;
        this.fuchurRig = null;
        this.etBikeRig = null;
        this.deloreanRig = null;
        this.ufoRig = null;
        this.paramotorRig = null;
    },

    /**
     * Switches or initializes the active 3D avatar model in the scene.
     */
    buildActiveAvatar(avatarType = 'aero_wyvern') {
        const KNOWN = ['aero_wyvern', 'fuchur', 'et_bike', 'delorean', 'mars_ufo', 'paramotor'];
        this.currentAvatarType = KNOWN.includes(avatarType) ? avatarType : 'aero_wyvern';
        const defaultY = typeof GROUND_NEAR_TOUCH_ALTITUDE_Y !== 'undefined' ? GROUND_NEAR_TOUCH_ALTITUDE_Y : 1.35;
        let prevPos = new THREE.Vector3(this.dragonWorldX || 0, this.dragonCurrentY || defaultY, this.flightZ || 0);
        let prevRotY = -(this.dragonHeadingAngle || 0);
        let prevRotX = this.dragonPitchAngle || 0;
        let prevRotZ = this.dragonRollAngle || 0;

        if (this.dragonGroup) {
            prevPos.copy(this.dragonGroup.position);
            this.scene.remove(this.dragonGroup);
        }
        this.resetAvatarAnimationParts();

        if (this.currentAvatarType === 'aero_wyvern') {
            this.buildAeroWyvern();
        } else if (this.currentAvatarType === 'fuchur') {
            this.buildFuchurLuckdragon();
        } else if (this.currentAvatarType === 'et_bike') {
            this.buildBoyWithBicycleAndET();
        } else if (this.currentAvatarType === 'delorean') {
            this.buildBackToTheFutureDeLorean();
        } else if (this.currentAvatarType === 'paramotor') {
            window.LoopKickerJourneyAvatarModels.buildParamotor.call(this);
        } else {
            this.buildMarsAttacksUfo();
        }

        if (this.dragonGroup) {
            this.dragonGroup.position.copy(prevPos);
            this.dragonGroup.rotation.order = 'YXZ';
            this.dragonGroup.rotation.y = prevRotY;
            this.dragonGroup.rotation.x = prevRotX;
            this.dragonGroup.rotation.z = prevRotZ;
        }
    },

    /**
     * Procedural pearlescent ivory-white & mother-of-pearl scale/fur texture for Fuchur (Falkor).
     * Combines iridescent pink/gold/champagne scalloped scales with lush wavy luckdragon fur locks.
     */
    createFuchurPearlFurScaleTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        const bgGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        bgGrad.addColorStop(0.0, '#fffdfd');
        bgGrad.addColorStop(0.32, '#fdf2f8');
        bgGrad.addColorStop(0.65, '#fbe4ee');
        bgGrad.addColorStop(1.0, '#f5f3ff');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Overlapping mother-of-pearl scalloped luckdragon scales with iridescent sheen
        const rows = 16;
        const cols = 14;
        const cellW = canvas.width / cols;
        const cellH = canvas.height / rows;
        for (let r = -1; r <= rows; r++) {
            for (let c = -1; c <= cols; c++) {
                const cx = c * cellW + (r % 2 === 0 ? 0 : cellW * 0.5);
                const cy = r * cellH;
                const rad = cellW * 0.62;
                const seed = Math.abs(Math.sin(r * 31.7 + c * 73.9));
                const scaleGrad = ctx.createRadialGradient(
                    cx - rad * 0.14,
                    cy - rad * 0.28,
                    rad * 0.08,
                    cx,
                    cy + rad * 0.1,
                    rad * 1.05
                );
                scaleGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.98)');
                scaleGrad.addColorStop(0.45, 'rgba(253, 242, 248, 0.9)');
                scaleGrad.addColorStop(0.75, seed > 0.45 ? 'rgba(249, 168, 212, 0.42)' : 'rgba(221, 214, 254, 0.38)');
                scaleGrad.addColorStop(1.0, 'rgba(190, 140, 160, 0.48)');
                ctx.fillStyle = scaleGrad;
                ctx.beginPath();
                ctx.arc(cx, cy, rad, 0.05 * Math.PI, 0.95 * Math.PI);
                ctx.quadraticCurveTo(cx, cy - rad * 0.35, cx + Math.cos(0.05 * Math.PI) * rad, cy + Math.sin(0.05 * Math.PI) * rad);
                ctx.fill();

                ctx.strokeStyle = 'rgba(219, 112, 147, 0.28)';
                ctx.lineWidth = 1.6;
                ctx.stroke();

                // Delicate mother-of-pearl growth striation ridges inside each scale
                for (let s = -2; s <= 2; s++) {
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
                    ctx.lineWidth = 0.9;
                    ctx.beginPath();
                    ctx.moveTo(cx + s * 4.5, cy - rad * 0.15);
                    ctx.lineTo(cx + s * 6.5, cy + rad * 0.72);
                    ctx.stroke();
                }
            }
        }

        // Lush silky flowing luckdragon fur strands over the pearlescent scales
        for (let i = 0; i < 1650; i++) {
            const x = (Math.sin(i * 73.1 + 19.7) * 0.5 + 0.5) * canvas.width;
            const y = (Math.cos(i * 139.3 + 41.2) * 0.5 + 0.5) * canvas.height;
            const len = 15 + (i % 16);
            const wave = Math.sin(i * 0.75) * 5.2;
            ctx.strokeStyle = i % 3 === 0
                ? 'rgba(255, 255, 255, 0.76)'
                : (i % 3 === 1 ? 'rgba(250, 245, 240, 0.4)' : 'rgba(244, 114, 182, 0.16)');
            ctx.lineWidth = 1.25;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.quadraticCurveTo(x + wave, y + len * 0.5, x + wave * 0.4, y + len);
            ctx.stroke();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(3, 2);
        return texture;
    },

    /**
     * Procedural silky wavy golden-ivory mane & spaniel ear plumage texture for Fuchur (Falkor).
     */
    createFuchurSilkyManeTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        const baseGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        baseGrad.addColorStop(0.0, '#ffffff');
        baseGrad.addColorStop(0.45, '#fdfaf7');
        baseGrad.addColorStop(0.82, '#f3ece6');
        baseGrad.addColorStop(1.0, '#ddd2c8');
        ctx.fillStyle = baseGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Long wavy feathered locks of luckdragon mane hair
        for (let i = 0; i < 420; i++) {
            const x0 = (i / 420) * canvas.width + Math.sin(i * 13.7) * 4;
            const y0 = (Math.cos(i * 59.3) * 0.5 + 0.5) * 45;
            const y1 = y0 + 150 + (i % 65);
            const wave = Math.sin(i * 1.4) * 14;
            ctx.strokeStyle = i % 2 === 0 ? 'rgba(255, 255, 255, 0.85)' : 'rgba(160, 140, 130, 0.3)';
            ctx.lineWidth = 1.8 + (i % 3) * 0.7;
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.bezierCurveTo(x0 + wave, (y0 + y1) * 0.38, x0 - wave * 0.8, (y0 + y1) * 0.72, x0 + wave * 0.3, y1);
            ctx.stroke();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2);
        return texture;
    },

    /**
     * Builds Fuchur (Falkor the Luckdragon from Die unendliche Geschichte / The NeverEnding Story), modelled after the film:
     * a long, slender, wingless serpentine body with pearly white/rosy mother-of-pearl scales, a continuous flowing
     * snow-white mane from the brow to the fluffy tail tuft, a friendly dog-like head with big warm brown eyes,
     * long droopy furry ears, a smiling muzzle with pink tongue, small tucked paws,
     * and Atreyu riding atop Fuchur's neck wearing the golden AURYN amulet!
     */
    buildFuchurLuckdragon() {
        this.dragonGroup = new THREE.Group();
        const pearlTex = this.createFuchurPearlFurScaleTexture();
        const maneTex = (this.createFuchurSilkyManeTexture || window.LoopKickerJourneyAvatarModels.createFuchurSilkyManeTexture).call(this);
        const hornTex = this.dragonHornBoneTexture || this.createDragonHornBoneTexture();

        // Helper to organically sculpt sphere/cylinder/box vertices and recompute smooth normals
        const sculptGeometry = (geo, deformFn) => {
            const pos = geo.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                const vx = pos.getX(i);
                const vy = pos.getY(i);
                const vz = pos.getZ(i);
                const [nx, ny, nz] = deformFn(vx, vy, vz);
                pos.setXYZ(i, nx, ny, nz);
            }
            pos.needsUpdate = true;
            geo.computeVertexNormals();
            return geo;
        };

        // Film-accurate palette: pearly white body with a rosy mother-of-pearl shimmer, snow-white mane
        const pearlFurMat = new THREE.MeshPhongMaterial({
            color: 0xfff8fa,
            map: pearlTex,
            bumpMap: pearlTex,
            bumpScale: 0.06,
            emissive: 0x2a2024,
            specular: 0xfbcfe8,
            shininess: 90
        });
        const maneFurMat = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            map: maneTex,
            bumpMap: maneTex,
            bumpScale: 0.09,
            emissive: 0x2c2826,
            specular: 0xffffff,
            shininess: 28
        });
        const pinkPearlFurMat = new THREE.MeshPhongMaterial({
            color: 0xfbd5e5,
            map: maneTex,
            bumpMap: maneTex,
            bumpScale: 0.065,
            emissive: 0x3b1828,
            specular: 0xffffff,
            shininess: 60
        });
        const noseMat = new THREE.MeshPhongMaterial({
            color: 0xc98a96,
            emissive: 0x2a0f14,
            specular: 0xffffff,
            shininess: 120
        });

        // Soft elongated fur lock (ellipsoid with its root at the origin, growing along +y).
        // rx > 0 sweeps the lock back towards the tail (+z), rz tilts it sideways, ry swings sideways locks backwards.
        const furLockGeo = new THREE.SphereGeometry(1, 10, 8);
        furLockGeo.translate(0, 1, 0);
        const addFurLock = (parent, mat, x, y, z, len, rad, rx, rz = 0, flat = 0.7, ry = 0) => {
            const lock = new THREE.Mesh(furLockGeo, mat);
            lock.scale.set(rad * flat, len * 0.5, rad);
            lock.position.set(x, y, z);
            lock.rotation.set(rx, ry, rz);
            parent.add(lock);
            return lock;
        };

        // Continuous fur fringe: a thin ribbon running along +z (length `len`) whose top edge (+y) is scalloped
        // into soft locks swept towards the tail. It thins towards the tips; `taper` shortens later locks.
        const buildFurFringe = (len, height, locks, mat, taper = 0, thickness = 0.12) => {
            const w = len / locks;
            const shape = new THREE.Shape();
            shape.moveTo(0, 0);
            shape.lineTo(0, height * 0.3);
            for (let i = 0; i < locks; i++) {
                const z0 = i * w;
                const h = height * (1 - (i / locks) * taper) * (0.86 + 0.14 * Math.sin(i * 2.3 + 0.7));
                const valley = Math.min(height * 0.45, h * 0.62);
                shape.bezierCurveTo(z0 + w * 0.15, h * 0.9, z0 + w * 0.55, h * 1.05, z0 + w * 0.85, h * 0.92);
                shape.quadraticCurveTo(z0 + w * 0.98, h * 0.8, z0 + w, valley);
            }
            shape.lineTo(len, 0);
            shape.lineTo(0, 0);
            const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 6 });
            geo.translate(0, 0, -thickness / 2);
            geo.rotateY(-Math.PI / 2);
            sculptGeometry(geo, (x, y, z) => [x * (1 - 0.75 * Math.min(1, Math.max(0, y) / height)), y, z]);
            return new THREE.Mesh(geo, mat);
        };
        const clawMat = new THREE.MeshPhongMaterial({
            color: 0xfef3c7,
            map: hornTex,
            bumpMap: hornTex,
            bumpScale: 0.045,
            emissive: 0x291805,
            specular: 0xffffff,
            shininess: 135
        });

        // 1. Slender Serpentine Luckdragon Torso (Fuchur is long, supple and wingless – he swims through the air)
        const chestGeo = sculptGeometry(new THREE.SphereGeometry(1.0, 24, 18), (x, y, z) => {
            const chestDeep = (y < 0) ? Math.pow(Math.max(0, 1 - Math.abs(x) * 0.9), 1.5) * 0.1 : 0;
            const furRipple = Math.sin(z * 5.0 + y * 3.0) * 0.02;
            return [x * (0.9 + furRipple), y * 0.88 - chestDeep, z * 1.9];
        });
        const chestMesh = new THREE.Mesh(chestGeo, pearlFurMat);
        chestMesh.position.set(0, 0.14, -0.62);
        this.dragonGroup.add(chestMesh);

        // Soft white chest ruff hanging below the base of the neck
        for (let r = -1; r <= 1; r++) {
            addFurLock(this.dragonGroup, maneFurMat, r * 0.24, -0.45 + Math.abs(r) * 0.06, -2.0 + Math.abs(r) * 0.12, 0.8, 0.22, 2.75, -r * 0.2);
        }

        const midTorsoGeo = sculptGeometry(new THREE.SphereGeometry(0.92, 22, 16), (x, y, z) => {
            const archY = Math.sin(z * 1.35) * 0.05;
            const taper = 1.0 - (z / 0.92) * 0.1;
            return [x * 0.86 * taper, y * 0.82 * taper + archY, z * 1.95];
        });
        const midTorsoMesh = new THREE.Mesh(midTorsoGeo, pearlFurMat);
        midTorsoMesh.position.set(0, 0.09, 1.3);
        this.dragonGroup.add(midTorsoMesh);

        // Subtle shoulders where the small forelegs attach
        [-0.66, 0.66].forEach((sx) => {
            const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 12), pearlFurMat);
            shoulder.scale.set(0.8, 0.85, 1.3);
            shoulder.position.set(sx, 0.0, -0.95);
            this.dragonGroup.add(shoulder);
        });

        // Fuchur's signature flowing snow-white mane: one continuous fringe along the back
        const backMane = buildFurFringe(5.0, 0.62, 9, maneFurMat, 0.1, 0.16);
        backMane.position.set(0, 0.74, -2.1);
        backMane.rotation.x = 0.03;
        this.dragonGroup.add(backMane);

        // 2. 3-Segment S-Curved Luckdragon Neck with Fluffy Mane & Atreyu Rider
        this.neckSegments = [];
        const neckPositions = [
            { y: 0.38, z: -2.20, rx: 0.20, r: 0.72 },
            { y: 0.72, z: -3.02, rx: 0.30, r: 0.64 },
            { y: 1.05, z: -3.72, rx: 0.16, r: 0.58 }
        ];
        neckPositions.forEach((np, nIdx) => {
            const nGroup = new THREE.Group();
            nGroup.position.set(0, np.y, np.z);
            nGroup.rotation.x = np.rx;

            const nGeo = sculptGeometry(
                new THREE.CylinderGeometry(np.r * 0.88, np.r * 1.02, 1.18, 16, 4),
                (x, y, z) => {
                    const fluff = Math.cos(Math.atan2(z, x) * 3.0) * 0.035;
                    return [x * (1.0 + fluff), y, z * (0.95 - fluff * 0.4)];
                }
            );
            nGeo.rotateX(Math.PI / 2);
            nGroup.add(new THREE.Mesh(nGeo, pearlFurMat));

            // Neck mane: the dorsal fringe continues up the neck (shorter on the base segment where Atreyu sits)
            const neckMane = nIdx === 0
                ? buildFurFringe(0.42, 0.5, 1, maneFurMat, 0, 0.14)
                : buildFurFringe(1.1, 0.58, 2, maneFurMat, 0, 0.14);
            neckMane.position.set(0, np.r * 0.72, nIdx === 0 ? -0.6 : -0.58);
            nGroup.add(neckMane);

            // Iconic NeverEnding Story Detail: Young Warrior Atreyu Riding on Fuchur's Base Neck Segment holding onto the Mane!
            if (nIdx === 0) {
                const atreyuGroup = new THREE.Group();
                atreyuGroup.position.set(0, np.r * 0.74, 0.15);
                atreyuGroup.rotation.x = -0.12;

                const buckskinMat = new THREE.MeshPhongMaterial({ color: 0xb45309, specular: 0xfde68a, shininess: 40 });
                const skinMat = new THREE.MeshPhongMaterial({ color: 0xd97706, specular: 0xfef3c7, shininess: 55 });
                const hairMat = new THREE.MeshPhongMaterial({ color: 0x0f172a, specular: 0x475569, shininess: 85 });
                const cloakMat = new THREE.MeshPhongMaterial({ color: 0x78350f, side: THREE.DoubleSide, shininess: 35 });
                const aurynMat = new THREE.MeshPhongMaterial({
                    color: 0xfacc15,
                    emissive: 0x854d0e,
                    specular: 0xffffff,
                    shininess: 165
                });

                // Atreyu's Torso leaning heroically forward into the wind
                const aTorso = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.62, 12), buckskinMat);
                aTorso.position.set(0, 0.28, -0.05);
                aTorso.rotation.x = 0.38;
                atreyuGroup.add(aTorso);

                // The Golden AURYN Medallion (Double Ouroboros Amulet of the Childlike Empress) on Chest
                const aurynAmulet = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.022, 8, 16), aurynMat);
                aurynAmulet.position.set(0, 0.36, -0.24);
                aurynAmulet.rotation.x = 0.38;
                atreyuGroup.add(aurynAmulet);

                // Billowing Plains-Hunter Cloak streaming back in the slipstream
                const cloakGeo = sculptGeometry(new THREE.BoxGeometry(0.46, 0.04, 0.72, 6, 1, 6), (x, y, z) => {
                    const ripple = Math.sin(z * 6.0 + x * 4.0) * 0.04 * (z + 0.36);
                    return [x * (1.0 + (z + 0.36) * 0.35), y + ripple, z];
                });
                const cloak = new THREE.Mesh(cloakGeo, cloakMat);
                cloak.position.set(0, 0.42, 0.34);
                cloak.rotation.x = -0.22;
                atreyuGroup.add(cloak);

                // Atreyu's Head, Silver Headband & Long Flowing Black Hair Locks
                const aHead = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), skinMat);
                aHead.position.set(0, 0.62, -0.20);
                atreyuGroup.add(aHead);

                const headband = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.02, 8, 16), aurynMat);
                headband.rotation.x = Math.PI / 2 - 0.15;
                headband.position.set(0, 0.67, -0.20);
                atreyuGroup.add(headband);

                for (let h = -2; h <= 2; h++) {
                    const hairLock = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.48, 7), hairMat);
                    hairLock.position.set(h * 0.055, 0.62 - Math.abs(h) * 0.02, 0.02 + Math.abs(h) * 0.03);
                    hairLock.rotation.x = 1.38;
                    hairLock.rotation.z = -h * 0.15;
                    atreyuGroup.add(hairLock);
                }

                // Arms reaching forward gripping Fuchur's golden-white neck fur & Legs straddling the neck
                [-1, 1].forEach((side) => {
                    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.058, 0.48, 8), skinMat);
                    arm.position.set(side * 0.22, 0.34, -0.28);
                    arm.rotation.x = 1.18;
                    arm.rotation.z = side * 0.25;
                    atreyuGroup.add(arm);

                    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.082, 0.56, 8), buckskinMat);
                    leg.position.set(side * 0.38, -0.05, 0.04);
                    leg.rotation.z = -side * 0.52;
                    leg.rotation.x = 0.25;
                    atreyuGroup.add(leg);
                });

                nGroup.add(atreyuGroup);
            }

            this.dragonGroup.add(nGroup);
            this.neckSegments.push(nGroup);
        });

        // 3. Sculpted Friendly Canine/Lion Luckdragon Head (Fuchur / Falkor)
        this.dragonHeadGroup = new THREE.Group();
        this.dragonHeadGroup.position.set(0, 1.22, -4.42);

        // Broad Domed Canine-Lion Cranium with Cheek Fluff
        const craniumGeo = sculptGeometry(new THREE.SphereGeometry(0.84, 22, 18), (x, y, z) => {
            const cheekFluff = (y < 0.05 && Math.abs(x) > 0.32) ? 1.16 : 1.0;
            const browDome = (y > 0.2 && z < 0.1) ? 1.08 : 1.0;
            return [x * 0.98 * cheekFluff, y * 0.86 * browDome, z * 1.14];
        });
        const cranium = new THREE.Mesh(craniumGeo, pearlFurMat);
        cranium.position.set(0, 0.18, 0.12);
        this.dragonHeadGroup.add(cranium);

        // Sculpted Plush Dog-Like Snout, Dorsal Nasal Scales & Warm Smiling Upper Flews (Jowls)
        const snoutGeo = sculptGeometry(new THREE.SphereGeometry(0.62, 20, 16), (x, y, z) => {
            const muzzleFlare = (z < -0.25) ? 1.10 : 1.0;
            const smileCurve = (y < 0) ? Math.sin(Math.abs(x) * 2.5) * 0.06 : 0;
            return [x * 0.96 * muzzleFlare, y * 0.68 + smileCurve, z * 1.58];
        });
        const snout = new THREE.Mesh(snoutGeo, pearlFurMat);
        snout.position.set(0, 0.03, -0.96);
        this.dragonHeadGroup.add(snout);

        // Plush Rounded Smiling Jowls & Whisker Pads on Either Side of the Muzzle
        [-0.42, 0.42].forEach((jx) => {
            const jowl = new THREE.Mesh(new THREE.SphereGeometry(0.35, 14, 12), maneFurMat);
            jowl.scale.set(0.92, 0.78, 1.42);
            jowl.position.set(jx, -0.06, -0.86);
            jowl.rotation.z = jx * 0.22;
            this.dragonHeadGroup.add(jowl);

            // Fluffy white cheek fur sweeping back towards the ears
            const s = jx > 0 ? 1 : -1;
            addFurLock(this.dragonHeadGroup, maneFurMat, s * 0.64, -0.08, -0.2, 0.7, 0.2, 0, -s * 1.75, 0.55, -s * 0.75);
        });

        // Sculpted Soft Pink Canine-Dragon Nose with Flared Velvety Nostrils & Philtrum Crease
        const nose = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 14), noseMat);
        nose.scale.set(1.32, 0.88, 0.94);
        nose.position.set(0, 0.13, -1.78);
        this.dragonHeadGroup.add(nose);

        const nostrilRimMat = new THREE.MeshPhongMaterial({ color: 0xa8707c, shininess: 95 });
        const nostrilMat = new THREE.MeshBasicMaterial({ color: 0x3b1a20 });
        [-0.12, 0.12].forEach((nx) => {
            const nostrilRim = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.024, 8, 12), nostrilRimMat);
            nostrilRim.position.set(nx, 0.14, -1.94);
            nostrilRim.rotation.y = nx > 0 ? 0.42 : -0.42;
            nostrilRim.rotation.x = 0.25;
            this.dragonHeadGroup.add(nostrilRim);

            const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.058, 8, 8), nostrilMat);
            nostril.position.set(nx, 0.14, -1.95);
            this.dragonHeadGroup.add(nostril);
        });

        // A few fine, short whiskers on the muzzle (Fuchur has a soft dog-like face, no long barbels)
        const whiskerTendrils = [];
        [-1, 1].forEach((side) => {
            const wPivot = new THREE.Group();
            wPivot.position.set(side * 0.46, -0.02, -1.28);

            for (let w = 0; w < 3; w++) {
                const whiskerGeo = new THREE.CylinderGeometry(0.005, 0.012, 0.62, 5);
                whiskerGeo.rotateZ(side * 1.25);
                const whisker = new THREE.Mesh(whiskerGeo, maneFurMat);
                whisker.position.set(side * 0.24, -0.04 - w * 0.06, 0.06 + w * 0.12);
                whisker.rotation.y = -side * (0.35 + w * 0.12);
                wPivot.add(whisker);
            }

            this.dragonHeadGroup.add(wPivot);
            whiskerTendrils.push(wPivot);
        });

        // Articulated Lower Jaw with Friendly Rounded Canine Teeth, Pink Tongue & Fluffy Chin Beard
        this.dragonJawGroup = new THREE.Group();
        this.dragonJawGroup.position.set(0, -0.20, -0.18);
        const lowerJaw = new THREE.Mesh(new THREE.SphereGeometry(0.48, 16, 12), pearlFurMat);
        lowerJaw.scale.set(0.94, 0.46, 1.58);
        lowerJaw.position.set(0, 0, -0.68);
        this.dragonJawGroup.add(lowerJaw);

        const tongueMat = new THREE.MeshPhongMaterial({
            color: 0xf43f5e,
            emissive: 0x4c0519,
            specular: 0xfda4af,
            shininess: 98
        });
        const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), tongueMat);
        tongue.scale.set(0.95, 0.28, 2.25);
        tongue.position.set(0, 0.09, -0.68);
        this.dragonJawGroup.add(tongue);

        // Friendly Rounded Ivory Canine Teeth on Lower & Upper Jaw
        [-0.24, 0.24].forEach((tx) => {
            const lowerTooth = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.15, 8), clawMat);
            lowerTooth.position.set(tx, 0.11, -1.02);
            this.dragonJawGroup.add(lowerTooth);

            const upperTooth = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 8), clawMat);
            upperTooth.position.set(tx * 1.12, -0.12, -1.18);
            upperTooth.rotation.x = Math.PI;
            this.dragonHeadGroup.add(upperTooth);
        });

        // Layered fluffy chin beard under the mandible
        for (let b = -1; b <= 1; b++) {
            addFurLock(this.dragonJawGroup, maneFurMat, b * 0.16, -0.14, -0.66 - (b === 0 ? 0.2 : 0.04),
                0.58 - Math.abs(b) * 0.08, 0.16, 2.6, -b * 0.18);
        }
        this.dragonHeadGroup.add(this.dragonJawGroup);

        // Big, kind, warm brown eyes (as in the film) with white sclera, glossy cornea, droopy lids & fluffy brows
        const eyeSocketMat = new THREE.MeshPhongMaterial({ color: 0xf6e9ee, shininess: 40 });
        const eyeMat = new THREE.MeshPhongMaterial({
            color: 0xfffaf4,
            emissive: 0x1c1816,
            specular: 0xffffff,
            shininess: 120
        });
        const irisRingMat = new THREE.MeshPhongMaterial({ color: 0x7a3f17, emissive: 0x2a1206, specular: 0xffe4c4, shininess: 140 });
        const irisInnerMat = new THREE.MeshPhongMaterial({ color: 0xa0612a, emissive: 0x3a1a08, shininess: 140 });
        const pupilMat = new THREE.MeshBasicMaterial({ color: 0x0b0806 });
        const highlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const corneaMat = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            specular: 0xffffff,
            shininess: 195,
            transparent: true,
            opacity: 0.22
        });

        [-1, 1].forEach((side) => {
            const socket = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 12), eyeSocketMat);
            socket.scale.set(0.85, 0.95, 1.1);
            socket.position.set(side * 0.46, 0.27, -0.29);
            this.dragonHeadGroup.add(socket);

            // Eyeball group looks forward and slightly outward
            const eyeGroup = new THREE.Group();
            eyeGroup.position.set(side * 0.5, 0.27, -0.33);
            eyeGroup.rotation.y = -side * 0.5;
            this.dragonHeadGroup.add(eyeGroup);

            eyeGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.235, 18, 16), eyeMat));

            const iris = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), irisRingMat);
            iris.scale.set(0.16, 0.165, 0.07);
            iris.position.set(0, 0, -0.192);
            eyeGroup.add(iris);

            const irisInner = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), irisInnerMat);
            irisInner.scale.set(0.12, 0.125, 0.05);
            irisInner.position.set(0, 0, -0.218);
            eyeGroup.add(irisInner);

            const pupil = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), pupilMat);
            pupil.scale.set(0.075, 0.08, 0.03);
            pupil.position.set(0, 0, -0.24);
            eyeGroup.add(pupil);

            // Catchlights give Fuchur his warm, wise gaze
            const highlight = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), highlightMat);
            highlight.position.set(side * 0.045, 0.06, -0.245);
            eyeGroup.add(highlight);

            const subHighlight = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), highlightMat);
            subHighlight.position.set(-side * 0.04, -0.05, -0.24);
            eyeGroup.add(subHighlight);

            eyeGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.242, 16, 14), corneaMat));

            // Gentle, slightly droopy upper eyelid fold
            const eyelid = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 8, 14, Math.PI), pearlFurMat);
            eyelid.position.set(side * 0.5, 0.29, -0.33);
            eyelid.rotation.y = side * 0.55;
            eyelid.rotation.z = -side * 0.12;
            this.dragonHeadGroup.add(eyelid);

            // Soft fluffy white eyebrow sweeping back over the eye
            addFurLock(this.dragonHeadGroup, maneFurMat, side * 0.48, 0.5, -0.36, 0.55, 0.11, 1.35, -side * 0.38, 0.8);
        });

        // Fuchur's Iconic Long Droopy Furry Spaniel-Like Ears (multi-layered with pink-pearl inner pinna, animate with watts!)
        const buildFuchurEar = (side) => {
            const earPivot = new THREE.Group();
            earPivot.position.set(side * 0.68, 0.24, 0.25);

            const earRoot = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), maneFurMat);
            earRoot.position.set(side * 0.08, -0.04, 0.08);
            earPivot.add(earRoot);

            const upperEar = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 14), maneFurMat);
            upperEar.scale.set(0.62, 1.38, 1.72);
            upperEar.position.set(side * 0.28, -0.26, 0.50);
            upperEar.rotation.z = side * 0.48;
            upperEar.rotation.x = 0.52;
            earPivot.add(upperEar);

            // Soft Rosy Mother-of-Pearl Inner Ear Cavity
            const innerPinna = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), pinkPearlFurMat);
            innerPinna.scale.set(0.42, 1.15, 1.45);
            innerPinna.position.set(side * 0.22, -0.30, 0.46);
            innerPinna.rotation.z = side * 0.48;
            innerPinna.rotation.x = 0.52;
            earPivot.add(innerPinna);

            const lowerPlume = new THREE.Mesh(new THREE.SphereGeometry(0.44, 16, 14), pearlFurMat);
            lowerPlume.scale.set(0.54, 1.18, 2.08);
            lowerPlume.position.set(side * 0.54, -0.54, 1.32);
            lowerPlume.rotation.z = side * 0.62;
            lowerPlume.rotation.x = 0.36;
            earPivot.add(lowerPlume);

            // Long silky fringe at the ear tips
            for (let ef = 0; ef < 2; ef++) {
                addFurLock(earPivot, maneFurMat, side * (0.5 + ef * 0.1), -0.6 + ef * 0.08, 1.8 + ef * 0.14, 0.85, 0.15, 1.5, -side * (0.32 + ef * 0.1), 0.6);
            }

            return earPivot;
        };
        const leftEar = buildFuchurEar(-1);
        const rightEar = buildFuchurEar(1);
        this.dragonHeadGroup.add(leftEar);
        this.dragonHeadGroup.add(rightEar);

        // Fluffy white forelock & crown mane flowing back from the brow into the neck mane (no horns)
        const crownMane = buildFurFringe(1.5, 0.62, 3, maneFurMat, 0, 0.3);
        crownMane.position.set(0, 0.74, -0.42);
        crownMane.rotation.x = 0.12;
        this.dragonHeadGroup.add(crownMane);
        [-1, 1].forEach((side) => {
            const sideMane = buildFurFringe(1.1, 0.5, 2, maneFurMat, 0, 0.12);
            sideMane.position.set(side * 0.32, 0.66, -0.1);
            sideMane.rotation.z = -side * 0.55;
            this.dragonHeadGroup.add(sideMane);
        });

        this.dragonGroup.add(this.dragonHeadGroup);

        // 4. Four Articulated Furry Luckdragon Legs with Elbow/Hock Feathering, Pink Paw Pads & Ivory Claws
        const forelegs = [];
        const hindlegs = [];
        [-1, 1].forEach((side) => {
            const fLeg = new THREE.Group();
            fLeg.position.set(side * 0.66, -0.28, -0.95);
            fLeg.scale.setScalar(0.72);

            const fUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.32, 0.92, 12), pearlFurMat);
            fUpper.rotation.x = 0.62;
            fUpper.position.set(0, -0.30, 0.22);
            fLeg.add(fUpper);

            // Feathered Elbow Plume
            for (let ep = 0; ep < 3; ep++) {
                const elbowPlume = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.52, 8), maneFurMat);
                elbowPlume.position.set(side * 0.08, -0.42 - ep * 0.10, 0.54 + ep * 0.06);
                elbowPlume.rotation.x = 1.38;
                fLeg.add(elbowPlume);
            }

            const fForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.24, 0.72, 12), pearlFurMat);
            fForearm.rotation.x = -0.35;
            fForearm.position.set(0, -0.66, 0.34);
            fLeg.add(fForearm);

            const fPaw = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), maneFurMat);
            fPaw.scale.set(1.15, 0.75, 1.38);
            fPaw.position.set(0, -0.84, 0.24);
            fLeg.add(fPaw);

            // Soft Pink Lion-Dog Paw Pad underneath
            const fPad = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), noseMat);
            fPad.scale.set(1.1, 0.35, 1.15);
            fPad.position.set(0, -0.98, 0.24);
            fLeg.add(fPad);

            for (let c = -1.5; c <= 1.5; c += 1.0) {
                const toe = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), maneFurMat);
                toe.scale.set(0.9, 0.8, 1.3);
                toe.position.set(c * 0.085, -0.88, 0.02);
                fLeg.add(toe);

                const claw = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.28, 8), clawMat);
                claw.position.set(c * 0.085, -0.92, -0.12);
                claw.rotation.x = -1.18;
                fLeg.add(claw);
            }
            this.dragonGroup.add(fLeg);
            forelegs.push(fLeg);

            const hLeg = new THREE.Group();
            hLeg.position.set(side * 0.6, -0.24, 2.0);
            hLeg.scale.setScalar(0.62);

            const hUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 1.08, 12), pearlFurMat);
            hUpper.rotation.x = 0.78;
            hUpper.position.set(0, -0.34, 0.35);
            hLeg.add(hUpper);

            const hShin = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.27, 0.78, 12), pearlFurMat);
            hShin.rotation.x = 1.12;
            hShin.position.set(0, -0.62, 0.74);
            hLeg.add(hShin);

            // Feathered Hock Fringe
            for (let hp = 0; hp < 3; hp++) {
                const hockPlume = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.56, 8), maneFurMat);
                hockPlume.position.set(side * 0.08, -0.52 - hp * 0.10, 0.92 + hp * 0.08);
                hockPlume.rotation.x = 1.45;
                hLeg.add(hockPlume);
            }

            const hPaw = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 12), maneFurMat);
            hPaw.scale.set(1.18, 0.76, 1.42);
            hPaw.position.set(0, -0.82, 0.96);
            hLeg.add(hPaw);

            for (let c = -1.5; c <= 1.5; c += 1.0) {
                const claw = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.30, 8), clawMat);
                claw.position.set(c * 0.09, -0.90, 1.18);
                claw.rotation.x = 1.65;
                hLeg.add(claw);
            }
            this.dragonGroup.add(hLeg);
            hindlegs.push(hLeg);
        });

        // 5. Fuchur has no wings – he swims through the air. The wing pivots carry soft flowing flank fur
        //    that ripples with the flight animation instead.
        const buildFuchurGlidePlume = (side) => {
            const pivot = new THREE.Group();
            pivot.position.set(side * 0.72, 0.3, -0.7);

            const flankFur = buildFurFringe(1.7, 0.62, 4, maneFurMat, 0.15, 0.1);
            flankFur.rotation.z = -side * 2.1;
            pivot.add(flankFur);

            const outerTipPivot = new THREE.Group();
            outerTipPivot.position.set(side * 0.04, -0.06, 1.6);
            const tipFur = buildFurFringe(1.1, 0.5, 3, pinkPearlFurMat, 0.3, 0.08);
            tipFur.rotation.z = -side * 2.15;
            outerTipPivot.add(tipFur);
            pivot.add(outerTipPivot);

            return { pivot, outerTipPivot };
        };
        const leftGlide = buildFuchurGlidePlume(-1);
        const rightGlide = buildFuchurGlidePlume(1);
        this.leftWingPivot = leftGlide.pivot;
        this.leftOuterWingPivot = leftGlide.outerTipPivot;
        this.rightWingPivot = rightGlide.pivot;
        this.rightOuterWingPivot = rightGlide.outerTipPivot;
        this.dragonGroup.add(this.leftWingPivot);
        this.dragonGroup.add(this.rightWingPivot);

        // 6. Long, Supple Serpentine Body with Continuous White Back Mane & a Flowing Tail Plume
        this.tailSegments = [];
        const tailCount = 15;
        for (let t = 0; t < tailCount; t++) {
            const segGroup = new THREE.Group();
            const r1 = Math.max(0.16, 0.8 - t * 0.045);
            const r2 = Math.max(0.14, r1 - 0.045);
            const segGeo = sculptGeometry(
                new THREE.CylinderGeometry(r2, r1, 0.92, 16, 3),
                (x, y, z) => [x, y, z * 0.94]
            );
            segGeo.rotateX(Math.PI / 2);
            segGroup.add(new THREE.Mesh(segGeo, pearlFurMat));

            // Rounded joint so the overlapping segments read as one smooth, tapering body
            const joint = new THREE.Mesh(new THREE.SphereGeometry(r1, 16, 12), pearlFurMat);
            joint.scale.set(1.0, 0.94, 1.0);
            joint.position.z = -0.46;
            segGroup.add(joint);

            // The back mane fringe continues down the tail, getting lower towards the tip
            const crestH = Math.max(0.2, 0.55 - t * 0.024);
            const crest = buildFurFringe(0.66, crestH, 1, maneFurMat, 0, Math.max(0.07, 0.14 - t * 0.004));
            crest.position.set(0, r1 * 0.82, -0.33);
            segGroup.add(crest);

            if (t === tailCount - 1) {
                // Soft flowing plume at the tail tip: one twisted, lobed teardrop of fur streaming back
                const plumeLen = 2.6;
                const plumePts = [];
                for (let p = 0; p <= 16; p++) {
                    const u = p / 16;
                    const r = 0.1 + 0.48 * Math.sin(Math.PI * Math.sqrt(u)) * (1 - 0.3 * u);
                    plumePts.push(new THREE.Vector2(p === 16 ? 0.001 : r, u * plumeLen));
                }
                const plumeGeo = sculptGeometry(new THREE.LatheGeometry(plumePts, 32), (x, y, z) => {
                    const a = Math.atan2(z, x);
                    const u = y / plumeLen;
                    const lobe = 1 + 0.2 * Math.cos(6 * a + u * 5.0) * Math.sin(Math.PI * u);
                    // Offsetting z bends the plume into a soft upward sweep once it is rotated along the tail
                    return [x * lobe, y, z * lobe * 0.8 + 0.35 * u * u];
                });
                plumeGeo.rotateX(Math.PI / 2);
                const plume = new THREE.Mesh(plumeGeo, maneFurMat);
                plume.position.set(0, 0.04, 0.2);
                plume.rotation.x = -0.06;
                segGroup.add(plume);
            }

            // Gentle resting S-curve instead of a straight rod
            segGroup.position.set(0, 0.32 * Math.sin(t * 0.38) - 0.04 * t, 2.75 + t * 0.64);
            this.dragonGroup.add(segGroup);
            this.tailSegments.push(segGroup);
        }

        this.avatarAnimParts = { leftEar, rightEar, forelegs, hindlegs, whiskerTendrils };
        this.fuchurRig = window.LoopKickerJourneyAvatarModels.createAvatarFlightState({
            neck: this.neckSegments.map((seg) => ({
                obj: seg, base: seg.position.clone(), baseRotX: seg.rotation.x, d: Math.max(0.2, -1.6 - seg.position.z)
            })),
            head: {
                obj: this.dragonHeadGroup,
                base: this.dragonHeadGroup.position.clone(),
                baseRotX: this.dragonHeadGroup.rotation.x,
                d: Math.max(0.5, -1.6 - this.dragonHeadGroup.position.z)
            },
            tail: this.tailSegments.map((seg, i) => ({ obj: seg, base: seg.position.clone(), d: Math.max(0.2, seg.position.z - 2.6), i })),
            plumes: [
                { pivot: leftGlide.pivot, tip: leftGlide.outerTipPivot, side: -1, baseRotY: leftGlide.pivot.rotation.y },
                { pivot: rightGlide.pivot, tip: rightGlide.outerTipPivot, side: 1, baseRotY: rightGlide.pivot.rotation.y }
            ],
            ears: [{ obj: leftEar, side: -1 }, { obj: rightEar, side: 1 }],
            whiskers: whiskerTendrils.map((w) => ({ obj: w, side: w.position.x < 0 ? -1 : 1 })),
            forelegs,
            hindlegs,
            kFront: 0,
            kTail: 0,
            kPitch: 0,
            swim: 0,
            swimPhase: 0
        });
        this.dragonGroup.position.set(0, this.dragonCurrentY, 0);
        this.scene.add(this.dragonGroup);
    },

    /**
     * Procedural leathery, wrinkled golden-russet & warm terracotta skin texture for E.T.
     */
    createETWrinkledSkinTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        const baseGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        baseGrad.addColorStop(0.0, '#9a5b25');
        baseGrad.addColorStop(0.45, '#b4692c');
        baseGrad.addColorStop(0.78, '#854d1e');
        baseGrad.addColorStop(1.0, '#6c3b14');
        ctx.fillStyle = baseGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Organic mottled terracotta/amber skin blotches
        for (let i = 0; i < 240; i++) {
            const x = (Math.sin(i * 91.3 + 17.1) * 0.5 + 0.5) * canvas.width;
            const y = (Math.cos(i * 137.9 + 53.4) * 0.5 + 0.5) * canvas.height;
            const rad = 10 + (i % 24);
            const g = ctx.createRadialGradient(x, y, 2, x, y, rad);
            g.addColorStop(0, i % 2 === 0 ? 'rgba(217, 130, 68, 0.24)' : 'rgba(72, 36, 12, 0.22)');
            g.addColorStop(1, 'rgba(146, 84, 34, 0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x, y, rad, 0, Math.PI * 2);
            ctx.fill();
        }

        // Deep horizontal forehead & neck skin wrinkle creases with highlight ridges
        for (let row = 0; row < 38; row++) {
            const y0 = (row / 38) * canvas.height;
            const amp = 4 + (row % 5) * 1.5;
            ctx.strokeStyle = 'rgba(54, 25, 8, 0.55)';
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            for (let x = 0; x <= canvas.width; x += 16) {
                const wy = y0 + Math.sin(x * 0.035 + row * 1.3) * amp;
                if (x === 0) ctx.moveTo(x, wy);
                else ctx.lineTo(x, wy);
            }
            ctx.stroke();

            ctx.strokeStyle = 'rgba(235, 168, 108, 0.28)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            for (let x = 0; x <= canvas.width; x += 16) {
                const wy = y0 + 2.2 + Math.sin(x * 0.035 + row * 1.3) * amp;
                if (x === 0) ctx.moveTo(x, wy);
                else ctx.lineTo(x, wy);
            }
            ctx.stroke();
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(1.5, 1.5);
        return tex;
    },

    /**
     * Updates the BMX crankset, horizontal pedals, and 2-bone inverse kinematics (thigh, knee, shin, ankle)
     * for Elliott's legs so the sneakers stay planted on the pedals throughout the 360-degree pedal stroke.
     */
    updateEtBikePedaling(crankAngle = 0) {
        const parts = this.avatarAnimParts;
        if (!parts || !parts.crankPivot || !parts.leftLeg || !parts.rightLeg) return;

        parts.crankPivot.rotation.x = crankAngle;
        if (parts.leftPedal) {
            parts.leftPedal.rotation.x = -crankAngle;
        }
        if (parts.rightPedal) {
            parts.rightPedal.rotation.x = -crankAngle;
        }

        const bbY = typeof parts.bbY === 'number' ? parts.bbY : -0.95;
        const bbZ = typeof parts.bbZ === 'number' ? parts.bbZ : 0.25;
        const crankRadius = typeof parts.crankRadius === 'number' ? parts.crankRadius : 0.34;

        const solveLegIK = (leg) => {
            const theta = crankAngle + leg.armPhase;
            // Pedal spindle world position in bikeRoot space as crankPivot rotates around X
            const pedalY = bbY + crankRadius * Math.cos(theta);
            const pedalZ = bbZ + crankRadius * Math.sin(theta);

            // Target ankle position directly above the pedal platform
            const ankleY = pedalY + 0.085;
            const ankleZ = pedalZ + 0.04;

            const dy = ankleY - leg.hipY;
            const dz = ankleZ - leg.hipZ;
            const L1 = leg.thighLength;
            const L2 = leg.shinLength;
            const rawDist = Math.hypot(dy, dz);
            const dist = Math.min(L1 + L2 - 0.005, Math.max(Math.abs(L1 - L2) + 0.005, rawDist));

            // Angle measured from straight down (-Y) toward forward (-Z), where +rotation.x swings -Y toward -Z
            const phiTarget = Math.atan2(-dz, -dy);
            const cosHip = Math.max(-1, Math.min(1, (L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist)));
            const cosKnee = Math.max(-1, Math.min(1, (L1 * L1 + L2 * L2 - dist * dist) / (2 * L1 * L2)));

            const thighAngle = phiTarget + Math.acos(cosHip);
            const shinAngle = -(Math.PI - Math.acos(cosKnee));

            leg.legGroup.rotation.x = thighAngle;
            leg.shinGroup.rotation.x = shinAngle;
            if (leg.footGroup) {
                const ankleRock = Math.sin(theta) * 0.14;
                leg.footGroup.rotation.x = -(thighAngle + shinAngle) + ankleRock;
            }
        };

        solveLegIK(parts.leftLeg);
        solveLegIK(parts.rightLeg);
    },

    /**
     * Builds the Boy with Bicycle & E.T. (Elliott in red hoodie pedaling a classic 1980s BMX bicycle
     * across the sky with the iconic E.T. film character wrapped in a white blanket inside the front
     * wicker basket, featuring his bi-lobed wrinkled cranium, soulful sky-blue eyes with heavy eyelids,
     * telescoping ridged neck, glowing red Heart-Light chest, and glowing healing fingertip).
     */
    buildBoyWithBicycleAndET() {
        this.dragonGroup = new THREE.Group();

        // Helper to organically sculpt sphere/cylinder/box vertices and recompute smooth normals
        const sculptGeometry = (geo, deformFn) => {
            const pos = geo.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                const vx = pos.getX(i);
                const vy = pos.getY(i);
                const vz = pos.getZ(i);
                const [nx, ny, nz] = deformFn(vx, vy, vz);
                pos.setXYZ(i, nx, ny, nz);
            }
            pos.needsUpdate = true;
            geo.computeVertexNormals();
            return geo;
        };

        // Procedural wicker basket & E.T. leathery skin textures
        const wickerCanvas = document.createElement('canvas');
        wickerCanvas.width = 256;
        wickerCanvas.height = 256;
        const wCtx = wickerCanvas.getContext('2d');
        wCtx.fillStyle = '#b45309';
        wCtx.fillRect(0, 0, 256, 256);
        for (let y = 0; y < 256; y += 16) {
            for (let x = 0; x < 256; x += 32) {
                wCtx.fillStyle = ((x + y) % 32 === 0) ? '#d97706' : '#92400e';
                wCtx.fillRect(x, y, 28, 12);
            }
        }
        const wickerTex = new THREE.CanvasTexture(wickerCanvas);
        wickerTex.wrapS = THREE.RepeatWrapping;
        wickerTex.wrapT = THREE.RepeatWrapping;
        wickerTex.repeat.set(2, 2);

        const etSkinTex = (this.createETWrinkledSkinTexture || window.LoopKickerJourneyAvatarModels.createETWrinkledSkinTexture).call(this);

        const frameRedMat = new THREE.MeshPhongMaterial({
            color: 0xdc2626,
            emissive: 0x3b0707,
            specular: 0xffffff,
            shininess: 135
        });
        const chromeMat = new THREE.MeshPhongMaterial({
            color: 0xe2e8f0,
            specular: 0xffffff,
            shininess: 160
        });
        const darkMetalMat = new THREE.MeshPhongMaterial({
            color: 0x334155,
            specular: 0x94a3b8,
            shininess: 95
        });
        const tireMat = new THREE.MeshPhongMaterial({
            color: 0x1e293b,
            specular: 0x475569,
            shininess: 35
        });
        const reflectorMat = new THREE.MeshPhongMaterial({
            color: 0xf59e0b,
            emissive: 0xd97706,
            emissiveIntensity: 0.65,
            specular: 0xffffff,
            shininess: 140
        });
        const hoodieRedMat = new THREE.MeshPhongMaterial({
            color: 0xef4444,
            emissive: 0x450a0a,
            specular: 0xfca5a5,
            shininess: 42
        });
        const jeansMat = new THREE.MeshPhongMaterial({
            color: 0x1d4ed8,
            emissive: 0x0f172a,
            specular: 0x60a5fa,
            shininess: 35
        });
        const skinMat = new THREE.MeshPhongMaterial({
            color: 0xfdba74,
            emissive: 0x431407,
            specular: 0xffedd5,
            shininess: 45
        });
        const etSkinMat = new THREE.MeshPhongMaterial({
            color: 0xb4692c,
            map: etSkinTex,
            bumpMap: etSkinTex,
            bumpScale: 0.048,
            emissive: 0x2d1606,
            specular: 0xfde68a,
            shininess: 48
        });
        const etDarkCreaseMat = new THREE.MeshPhongMaterial({
            color: 0x5c2d0c,
            map: etSkinTex,
            bumpMap: etSkinTex,
            bumpScale: 0.035,
            emissive: 0x1f0d02,
            specular: 0x9a5b25,
            shininess: 32
        });
        const blanketMat = new THREE.MeshPhongMaterial({
            color: 0xf8fafc,
            emissive: 0x1e293b,
            specular: 0xffffff,
            shininess: 30,
            side: THREE.DoubleSide
        });
        const basketMat = new THREE.MeshPhongMaterial({
            color: 0xd97706,
            map: wickerTex,
            bumpMap: wickerTex,
            bumpScale: 0.06,
            shininess: 40
        });

        const bikeRoot = new THREE.Group();
        bikeRoot.scale.set(1.38, 1.38, 1.38);
        this.dragonGroup.add(bikeRoot);

        // Helper to connect two 3D points with a cylindrical frame tube
        const addTube = (parent, p1, p2, r, mat) => {
            const v1 = new THREE.Vector3(...p1);
            const v2 = new THREE.Vector3(...p2);
            const dir = new THREE.Vector3().subVectors(v2, v1);
            const len = dir.length();
            const geo = new THREE.CylinderGeometry(r, r, len, 12);
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.copy(v1).add(v2).multiplyScalar(0.5);
            mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
            parent.add(mesh);
            return mesh;
        };

        // Front & Rear Spoked BMX Wheels (centered around X=0, oriented along Z)
        const buildSpokedWheel = (zPos) => {
            const wheelGroup = new THREE.Group();
            wheelGroup.position.set(0, -1.05, zPos);

            const tire = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.14, 14, 32), tireMat);
            tire.rotation.y = Math.PI / 2;
            wheelGroup.add(tire);

            const rim = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.045, 10, 28), chromeMat);
            rim.rotation.y = Math.PI / 2;
            wheelGroup.add(rim);

            const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.28, 12), chromeMat);
            hub.rotation.z = Math.PI / 2;
            wheelGroup.add(hub);

            for (let s = 0; s < 12; s++) {
                const angle = (s / 12) * Math.PI * 2;
                const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.54, 6), chromeMat);
                spoke.rotation.x = angle;
                wheelGroup.add(spoke);
            }

            // Classic amber wheel spoke reflector
            const wheelReflector = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.09, 0.18), reflectorMat);
            wheelReflector.position.set(0, 0.52, 0);
            wheelGroup.add(wheelReflector);

            bikeRoot.add(wheelGroup);
            return wheelGroup;
        };

        const frontWheel = buildSpokedWheel(-1.85);
        const rearWheel = buildSpokedWheel(1.75);

        // Classic Diamond BMX Frame, Fork, Handlebars & Saddle
        const bbY = -0.95;
        const bbZ = 0.25;
        const bbPos = [0, bbY, bbZ];
        const seatTop = [0, 0.22, 0.72];
        const headTop = [0, 0.35, -1.35];
        const headBot = [0, -0.15, -1.50];
        const rearAxleL = [-0.16, -1.05, 1.75];
        const rearAxleR = [0.16, -1.05, 1.75];
        const frontAxleL = [-0.16, -1.05, -1.85];
        const frontAxleR = [0.16, -1.05, -1.85];

        addTube(bikeRoot, bbPos, seatTop, 0.075, frameRedMat);
        addTube(bikeRoot, bbPos, headBot, 0.08, frameRedMat);
        addTube(bikeRoot, seatTop, headTop, 0.075, frameRedMat);
        addTube(bikeRoot, headBot, headTop, 0.085, frameRedMat);
        addTube(bikeRoot, bbPos, rearAxleL, 0.05, frameRedMat);
        addTube(bikeRoot, bbPos, rearAxleR, 0.05, frameRedMat);
        addTube(bikeRoot, seatTop, rearAxleL, 0.048, frameRedMat);
        addTube(bikeRoot, seatTop, rearAxleR, 0.048, frameRedMat);
        addTube(bikeRoot, headBot, frontAxleL, 0.055, chromeMat);
        addTube(bikeRoot, headBot, frontAxleR, 0.055, chromeMat);

        // Chrome seatpost connecting frame to saddle
        addTube(bikeRoot, seatTop, [0, 0.36, 0.76], 0.048, chromeMat);

        // BMX Rise Handlebars & Grips
        addTube(bikeRoot, headTop, [-0.58, 0.92, -1.32], 0.045, chromeMat);
        addTube(bikeRoot, headTop, [0.58, 0.92, -1.32], 0.045, chromeMat);
        addTube(bikeRoot, [-0.42, 0.75, -1.32], [0.42, 0.75, -1.32], 0.035, chromeMat);
        [-1, 1].forEach((side) => {
            const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.34, 10), tireMat);
            grip.rotation.z = Math.PI / 2;
            grip.position.set(side * 0.72, 0.92, -1.32);
            bikeRoot.add(grip);
        });

        // Saddle
        const saddle = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), tireMat);
        saddle.scale.set(0.75, 0.38, 1.45);
        saddle.position.set(0, 0.38, 0.78);
        bikeRoot.add(saddle);

        // Front Wicker Basket & Iconic Film Character E.T. Wrapped in White Blanket
        const basketGroup = new THREE.Group();
        basketGroup.position.set(0, 0.42, -1.88);
        const basketMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.46, 0.78, 18), basketMat);
        basketMesh.scale.set(1.15, 1.0, 0.88);
        basketGroup.add(basketMesh);

        // Woven Top Rim & Handlebar Leather Straps on the Wicker Basket
        const basketRim = new THREE.Mesh(new THREE.TorusGeometry(0.61, 0.055, 10, 24), basketMat);
        basketRim.rotation.x = Math.PI / 2;
        basketRim.scale.set(1.15, 0.88, 1.0);
        basketRim.position.set(0, 0.39, 0);
        basketGroup.add(basketRim);

        [-0.32, 0.32].forEach((sx) => {
            addTube(basketGroup, [sx, 0.32, 0.44], [sx, 0.48, 0.56], 0.032, etDarkCreaseMat);
        });

        // Draped White Blanket Body & Folded Collar Inside the Basket (open in front for E.T.'s chest & Heart-Light)
        const blanketShroud = new THREE.Mesh(new THREE.SphereGeometry(0.52, 18, 14), blanketMat);
        blanketShroud.scale.set(1.12, 0.98, 0.86);
        blanketShroud.position.set(0, 0.34, 0.06);
        basketGroup.add(blanketShroud);

        // Left & Right Blanket Lapels / Shawl Folds framing E.T.'s chest
        [-1, 1].forEach((side) => {
            const shawlFold = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.66, 12), blanketMat);
            shawlFold.position.set(side * 0.34, 0.48, -0.22);
            shawlFold.rotation.z = side * 0.28;
            shawlFold.rotation.x = 0.22;
            basketGroup.add(shawlFold);
        });

        // E.T.'s Ribbed Upper Chest & Warmly Glowing Red-Amber Heart-Light visible through the open blanket front
        const etChest = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), etSkinMat);
        etChest.scale.set(1.05, 1.12, 0.78);
        etChest.position.set(0, 0.42, -0.18);
        basketGroup.add(etChest);

        for (let r = 0; r < 3; r++) {
            const ribArc = new THREE.Mesh(new THREE.TorusGeometry(0.24 - r * 0.02, 0.024, 8, 14, Math.PI * 0.75), etSkinMat);
            ribArc.position.set(0, 0.48 - r * 0.08, -0.22);
            ribArc.rotation.x = Math.PI / 2;
            ribArc.rotation.z = -Math.PI * 0.875;
            basketGroup.add(ribArc);
        }

        const heartLightMat = new THREE.MeshPhongMaterial({
            color: 0xff3b1f,
            emissive: 0xef4444,
            emissiveIntensity: 0.95,
            specular: 0xffffff,
            shininess: 120
        });
        const heartLightMesh = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 12), heartLightMat);
        heartLightMesh.scale.set(0.95, 1.15, 0.65);
        heartLightMesh.position.set(0.05, 0.44, -0.42);
        basketGroup.add(heartLightMesh);

        // E.T.'s Iconic Telescoping Ringed Neck rising from his shoulders to his wide head
        const etNeckGroup = new THREE.Group();
        etNeckGroup.position.set(0, 0.64, -0.10);
        const neckCore = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.19, 0.34, 14), etSkinMat);
        neckCore.position.set(0, 0.08, 0);
        etNeckGroup.add(neckCore);

        for (let nr = 0; nr < 4; nr++) {
            const neckRing = new THREE.Mesh(new THREE.TorusGeometry(0.165 - nr * 0.008, 0.036, 10, 18), etSkinMat);
            neckRing.rotation.x = Math.PI / 2;
            neckRing.scale.set(1.08, 0.92, 1.0);
            neckRing.position.set(0, -0.03 + nr * 0.072, -0.01 * nr);
            etNeckGroup.add(neckRing);
        }
        basketGroup.add(etNeckGroup);

        // E.T. Head Group (Carlo Rambaldi's wide flattened bi-lobed cranium, heavy eyelids, soulful sky-blue eyes, pug nose & gentle smile)
        const etHeadGroup = new THREE.Group();
        etHeadGroup.position.set(0, 0.94, -0.14);
        etHeadGroup.userData.baseY = 0.94;

        // Open Draped White Blanket Hood Cowl framing the back, top-rear & sides of E.T.'s head without covering his face
        const etHoodBack = sculptGeometry(new THREE.SphereGeometry(0.49, 20, 16), (x, y, z) => {
            // Carve open the front (-Z) so E.T.'s face is completely unobstructed
            const frontCut = z < -0.05 ? 0.15 : 1.0;
            const flareX = 1.26 + (y < 0 ? 0.14 : 0);
            const drapeY = y < -0.1 ? y * 1.18 : y * 0.96;
            return [x * flareX, drapeY, z < -0.05 ? -0.05 + (z + 0.05) * frontCut : z * 1.08 + 0.12];
        });
        const etHoodMesh = new THREE.Mesh(etHoodBack, blanketMat);
        etHoodMesh.position.set(0, 0.01, 0.08);
        etHeadGroup.add(etHoodMesh);

        // Hood Cowl Arch Rim framing E.T.'s wide forehead and cheeks
        const hoodCowlRim = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.068, 12, 24, Math.PI * 1.28), blanketMat);
        hoodCowlRim.scale.set(1.24, 0.88, 1.0);
        hoodCowlRim.rotation.z = -Math.PI * 0.14;
        hoodCowlRim.position.set(0, -0.02, -0.02);
        etHeadGroup.add(hoodCowlRim);

        // E.T.'s Sculpted Bi-Lobed (Heart/Peanut-Shaped) Cranium with Central Sagittal Furrow & Wide Cheekbones
        const etCraniumGeo = sculptGeometry(new THREE.SphereGeometry(0.38, 24, 20), (x, y, z) => {
            const nx = x / 0.38;
            const ny = y / 0.38;
            const nz = z / 0.38;
            // Bi-lobed widening at the temples and slight dip along the top midline (nx ~ 0)
            const templeBulge = 1.38 + (ny > -0.15 ? 0.18 * Math.sin(Math.min(1, Math.abs(nx)) * Math.PI * 0.5) : -0.10);
            const sagittalDip = (ny > 0.25 && Math.abs(nx) < 0.45) ? -0.042 * Math.cos(nx * Math.PI) : 0;
            // Taper down toward the chin while pushing the muzzle/snout slightly forward
            const jawNarrow = ny < -0.2 ? (1.0 - Math.min(0.32, (-ny - 0.2) * 0.38)) : 1.0;
            const muzzleProtrude = (nz < -0.25 && ny < 0.05 && ny > -0.65) ? -0.055 : 0;
            return [
                x * templeBulge * jawNarrow,
                y * 0.82 + sagittalDip,
                z * 0.96 + muzzleProtrude
            ];
        });
        const etCranium = new THREE.Mesh(etCraniumGeo, etSkinMat);
        etCranium.position.set(0, 0.03, -0.08);
        etHeadGroup.add(etCranium);

        // Prominent Furrowed Forehead Wrinkle Creases across E.T.'s Upper Brow
        for (let fw = 0; fw < 3; fw++) {
            const wrinkleArc = new THREE.Mesh(
                new THREE.TorusGeometry(0.28 - fw * 0.025, 0.016, 8, 18, Math.PI * 0.68),
                fw % 2 === 0 ? etDarkCreaseMat : etSkinMat
            );
            wrinkleArc.scale.set(1.35, 0.35, 0.85);
            wrinkleArc.position.set(0, 0.21 - fw * 0.038, -0.37 - fw * 0.01);
            wrinkleArc.rotation.x = 0.28;
            wrinkleArc.rotation.z = Math.PI * 0.16;
            etHeadGroup.add(wrinkleArc);
        }

        // Soulful Wide-Set Sky-Blue E.T. Eyes with Milky Sclera, Heavy Drooping Eyelids & Specular Catchlights
        const scleraMat = new THREE.MeshPhongMaterial({
            color: 0xfef3c7,
            emissive: 0x291d0a,
            specular: 0xffffff,
            shininess: 110
        });
        const etIrisOuterMat = new THREE.MeshPhongMaterial({
            color: 0x0284c7,
            emissive: 0x0369a1,
            emissiveIntensity: 0.42,
            specular: 0xffffff,
            shininess: 145
        });
        const etIrisInnerMat = new THREE.MeshPhongMaterial({
            color: 0x38bdf8,
            emissive: 0x0284c7,
            emissiveIntensity: 0.55,
            specular: 0xffffff,
            shininess: 160
        });
        const pupilMat = new THREE.MeshBasicMaterial({ color: 0x020617 });
        const catchlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

        [-1, 1].forEach((side) => {
            const ex = side * 0.21;
            const ey = 0.05;
            const ez = -0.35;

            // Heavy Arched Supraorbital Brow Ridge
            const browRidge = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.034, 10, 16, Math.PI * 0.92), etSkinMat);
            browRidge.scale.set(1.22, 0.82, 1.0);
            browRidge.position.set(ex, ey + 0.065, ez - 0.02);
            browRidge.rotation.z = -side * 0.22;
            browRidge.rotation.y = -side * 0.18;
            etHeadGroup.add(browRidge);

            // Milky-Ivory Sclera Eyeball
            const eyeball = new THREE.Mesh(new THREE.SphereGeometry(0.112, 16, 16), scleraMat);
            eyeball.scale.set(1.08, 0.96, 0.92);
            eyeball.position.set(ex, ey, ez);
            etHeadGroup.add(eyeball);

            // Deep Cerulean Outer Iris Ring & Luminous Sky-Blue Inner Iris
            const irisOuter = new THREE.Mesh(new THREE.SphereGeometry(0.078, 14, 14), etIrisOuterMat);
            irisOuter.scale.set(1.0, 1.0, 0.55);
            irisOuter.position.set(ex * 0.98, ey, ez - 0.072);
            etHeadGroup.add(irisOuter);

            const irisInner = new THREE.Mesh(new THREE.SphereGeometry(0.064, 12, 12), etIrisInnerMat);
            irisInner.scale.set(1.0, 1.0, 0.52);
            irisInner.position.set(ex * 0.98, ey, ez - 0.084);
            etHeadGroup.add(irisInner);

            // Large Dilated Dark Pupil
            const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 10), pupilMat);
            pupil.scale.set(1.0, 1.0, 0.45);
            pupil.position.set(ex * 0.97, ey, ez - 0.098);
            etHeadGroup.add(pupil);

            // Dual Specular Eye Catchlights (gives E.T. his gentle, soulful cinematic expression)
            const catchlight1 = new THREE.Mesh(new THREE.SphereGeometry(0.019, 8, 8), catchlightMat);
            catchlight1.position.set(ex - 0.024, ey + 0.026, ez - 0.115);
            etHeadGroup.add(catchlight1);

            const catchlight2 = new THREE.Mesh(new THREE.SphereGeometry(0.010, 6, 6), catchlightMat);
            catchlight2.position.set(ex + 0.022, ey - 0.018, ez - 0.112);
            etHeadGroup.add(catchlight2);

            // Characteristic Heavy Wrinkled Upper Eyelid Hood (angled gently down toward the outer temples)
            const upperEyelid = new THREE.Mesh(
                new THREE.SphereGeometry(0.122, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.54),
                etSkinMat
            );
            upperEyelid.scale.set(1.12, 0.96, 1.02);
            upperEyelid.position.set(ex, ey + 0.008, ez);
            upperEyelid.rotation.x = -0.32;
            upperEyelid.rotation.z = -side * 0.20;
            etHeadGroup.add(upperEyelid);

            // Pouchy Wrinkled Lower Eyelid Bag
            const lowerEyelid = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.025, 8, 14, Math.PI * 0.85), etSkinMat);
            lowerEyelid.scale.set(1.14, 0.68, 0.95);
            lowerEyelid.position.set(ex, ey - 0.032, ez - 0.035);
            lowerEyelid.rotation.z = Math.PI + side * 0.12;
            etHeadGroup.add(lowerEyelid);

            // Full Sculpted Cheek Pouches beneath the Eyes
            const cheekPouch = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), etSkinMat);
            cheekPouch.scale.set(1.18, 0.78, 0.88);
            cheekPouch.position.set(side * 0.23, -0.08, -0.32);
            etHeadGroup.add(cheekPouch);
        });

        // E.T.'s Short, Flat Upturned Pug Nose Bridge & Indented Dark Nostrils
        const noseBridge = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), etSkinMat);
        noseBridge.scale.set(1.18, 0.72, 0.85);
        noseBridge.position.set(0, -0.02, -0.43);
        etHeadGroup.add(noseBridge);

        [-0.034, 0.034].forEach((nx) => {
            const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.020, 8, 8), etDarkCreaseMat);
            nostril.scale.set(0.85, 1.25, 0.7);
            nostril.position.set(nx, -0.032, -0.495);
            etHeadGroup.add(nostril);
        });

        // Wide Muzzle Upper Lip, Gentle Upturned Mouth Smile Crease & Wrinkled Chin
        const upperMuzzle = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 10), etSkinMat);
        upperMuzzle.scale.set(1.42, 0.56, 0.86);
        upperMuzzle.position.set(0, -0.10, -0.35);
        etHeadGroup.add(upperMuzzle);

        const mouthCrease = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.015, 8, 18, Math.PI * 0.78), etDarkCreaseMat);
        mouthCrease.scale.set(1.22, 0.42, 0.75);
        mouthCrease.position.set(0, -0.115, -0.38);
        mouthCrease.rotation.x = 0.25;
        mouthCrease.rotation.z = Math.PI + Math.PI * 0.11;
        etHeadGroup.add(mouthCrease);

        const lowerChin = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), etSkinMat);
        lowerChin.scale.set(1.28, 0.58, 0.84);
        lowerChin.position.set(0, -0.175, -0.33);
        etHeadGroup.add(lowerChin);

        // E.T.'s Left Four-Fingered Hand Gripping the Front Wicker Basket Rim
        const leftPalm = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 10), etSkinMat);
        leftPalm.scale.set(1.15, 0.65, 1.1);
        leftPalm.position.set(-0.34, -0.48, -0.36);
        etHeadGroup.add(leftPalm);
        for (let lf = 0; lf < 4; lf++) {
            const fx = -0.40 + lf * 0.038;
            addTube(etHeadGroup, [fx, -0.48, -0.36], [fx, -0.53, -0.47], 0.016, etSkinMat);
            const tip = new THREE.Mesh(new THREE.SphereGeometry(0.021, 8, 8), etSkinMat);
            tip.position.set(fx, -0.54, -0.48);
            etHeadGroup.add(tip);
        }

        // E.T.'s Outstretched Right Arm, Four-Fingered Hand & Iconic Glowing Red-Amber Healing Index Fingertip
        addTube(etHeadGroup, [0.24, -0.36, -0.12], [0.40, -0.18, -0.42], 0.048, etSkinMat);
        const rightPalm = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 10), etSkinMat);
        rightPalm.scale.set(1.05, 0.75, 1.15);
        rightPalm.position.set(0.41, -0.16, -0.45);
        etHeadGroup.add(rightPalm);

        // Three curled companion fingers + thumb on E.T.'s right hand
        for (let rf = 0; rf < 3; rf++) {
            const fy = -0.18 - rf * 0.028;
            addTube(etHeadGroup, [0.43, fy, -0.46], [0.48, fy - 0.02, -0.56], 0.015, etSkinMat);
        }
        // Extra-long articulated E.T. index finger with knuckle joint & glowing healing fingertip
        addTube(etHeadGroup, [0.42, -0.14, -0.46], [0.49, -0.05, -0.66], 0.020, etSkinMat);
        const knuckleJoint = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), etSkinMat);
        knuckleJoint.position.set(0.46, -0.09, -0.57);
        etHeadGroup.add(knuckleJoint);

        const fingerTipGlowMat = new THREE.MeshBasicMaterial({ color: 0xff5500 });
        const glowingFingerTip = new THREE.Mesh(new THREE.SphereGeometry(0.072, 14, 14), fingerTipGlowMat);
        glowingFingerTip.position.set(0.51, -0.02, -0.71);
        etHeadGroup.add(glowingFingerTip);

        const fingerHaloMat = new THREE.MeshBasicMaterial({
            color: 0xfbbf24,
            transparent: true,
            opacity: 0.42
        });
        const fingerGlowHalo = new THREE.Mesh(new THREE.SphereGeometry(0.125, 14, 14), fingerHaloMat);
        glowingFingerTip.add(fingerGlowHalo);

        basketGroup.add(etHeadGroup);
        bikeRoot.add(basketGroup);
        this.dragonHeadGroup = etHeadGroup;

        // Complete BMX Drivetrain: Bottom Bracket, Chainring, Rear Cog, Drive Chain, Crank Arms & Horizontal Pedals
        const crankRadius = 0.34;
        const crankPivot = new THREE.Group();
        crankPivot.position.set(0, bbY, bbZ);

        // Bottom bracket axle spindle
        const bbSpindle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.38, 12), chromeMat);
        bbSpindle.rotation.z = Math.PI / 2;
        crankPivot.add(bbSpindle);

        // Right-side chrome chainring & inner spider spokes
        const chainring = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.035, 24), chromeMat);
        chainring.rotation.z = Math.PI / 2;
        chainring.position.x = 0.13;
        crankPivot.add(chainring);

        const chainringRing = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.025, 8, 24), darkMetalMat);
        chainringRing.rotation.y = Math.PI / 2;
        chainringRing.position.x = 0.135;
        crankPivot.add(chainringRing);

        // Rear sprocket cog & upper/lower bicycle drive chain runs
        const rearCog = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 16), darkMetalMat);
        rearCog.rotation.z = Math.PI / 2;
        rearCog.position.set(0.13, -1.05, 1.75);
        bikeRoot.add(rearCog);
        addTube(bikeRoot, [0.135, bbY + 0.25, bbZ], [0.135, -1.05 + 0.12, 1.75], 0.018, darkMetalMat);
        addTube(bikeRoot, [0.135, bbY - 0.25, bbZ], [0.135, -1.05 - 0.12, 1.75], 0.018, darkMetalMat);

        // Helper to build a crank arm + counter-rotating BMX platform pedal with amber reflectors
        const buildCrankArmAndPedal = (side, armPhase) => {
            const armX = side * 0.16;
            const tipY = crankRadius * Math.cos(armPhase);
            const tipZ = crankRadius * Math.sin(armPhase);

            // Chrome crank arm from bottom bracket to pedal spindle
            addTube(crankPivot, [armX, 0, 0], [armX, tipY, tipZ], 0.032, chromeMat);

            const crankBoss = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 10), chromeMat);
            crankBoss.position.set(armX, tipY, tipZ);
            crankPivot.add(crankBoss);

            // Pedal group positioned at the crank arm tip; counter-rotates (-crankAngle) so pedal stays horizontal
            const pedalGroup = new THREE.Group();
            pedalGroup.position.set(side * 0.24, tipY, tipZ);

            // Chrome spindle connecting crank arm tip to pedal body
            const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 8), chromeMat);
            spindle.rotation.z = Math.PI / 2;
            spindle.position.set(-side * 0.04, 0, 0);
            pedalGroup.add(spindle);

            // Serrated BMX platform pedal body
            const pedalBody = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.048, 0.24), darkMetalMat);
            pedalGroup.add(pedalBody);

            const pedalCage = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.054, 0.25), tireMat);
            pedalCage.scale.set(1.0, 0.75, 1.0);
            pedalGroup.add(pedalCage);

            // Front & back amber safety reflectors on each pedal
            [-0.122, 0.122].forEach((rz) => {
                const reflector = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.028, 0.014), reflectorMat);
                reflector.position.set(0, 0, rz);
                pedalGroup.add(reflector);
            });

            crankPivot.add(pedalGroup);
            return pedalGroup;
        };

        // Left crank arm at phase PI, Right crank arm at phase 0 (180 degrees apart)
        const leftPedal = buildCrankArmAndPedal(-1, Math.PI);
        const rightPedal = buildCrankArmAndPedal(1, 0);
        bikeRoot.add(crankPivot);

        // Boy Rider (Elliott in Iconic Red Hoodie & Blue Jeans)
        const riderTorso = new THREE.Group();
        riderTorso.position.set(0, 0.98, 0.42);
        riderTorso.rotation.x = -0.42;

        // Pelvis / Denim Hips seated on the BMX saddle
        const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), jeansMat);
        pelvis.scale.set(1.05, 0.72, 0.92);
        pelvis.position.set(0, 0.44, 0.72);
        bikeRoot.add(pelvis);

        const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.30, 1.08, 14), hoodieRedMat);
        riderTorso.add(chest);

        // Hoodie Hood & Boy's Head with Cap/Hair
        const hoodBack = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), hoodieRedMat);
        hoodBack.position.set(0, 0.56, 0.16);
        riderTorso.add(hoodBack);

        const boyHead = new THREE.Mesh(new THREE.SphereGeometry(0.30, 16, 14), skinMat);
        boyHead.position.set(0, 0.78, -0.04);
        riderTorso.add(boyHead);

        const hairMat = new THREE.MeshPhongMaterial({ color: 0x451a03, shininess: 30 });
        const boyHair = new THREE.Mesh(new THREE.SphereGeometry(0.315, 14, 12), hairMat);
        boyHair.position.set(0, 0.85, 0.02);
        boyHair.scale.set(1.02, 0.88, 1.05);
        riderTorso.add(boyHair);

        bikeRoot.add(riderTorso);

        // Rider Arms reaching to BMX Handlebars
        [-1, 1].forEach((side) => {
            addTube(bikeRoot, [side * 0.36, 1.32, 0.15], [side * 0.54, 1.08, -0.62], 0.095, hoodieRedMat);
            addTube(bikeRoot, [side * 0.54, 1.08, -0.62], [side * 0.70, 0.92, -1.30], 0.08, hoodieRedMat);
            const hand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), skinMat);
            hand.position.set(side * 0.70, 0.92, -1.32);
            bikeRoot.add(hand);
        });

        // Articulated Left & Right Legs with 2-Bone IK (Hip -> Thigh -> Knee -> Shin -> Ankle -> Sneaker on Pedal)
        const leftLegGroup = new THREE.Group();
        const rightLegGroup = new THREE.Group();
        const hipY = 0.40;
        const hipZ = 0.72;
        const thighLength = 0.90;
        const shinLength = 0.88;

        const buildRiderLeg = (legGroup, side, armPhase) => {
            legGroup.position.set(side * 0.24, hipY, hipZ);

            const hipJoint = new THREE.Mesh(new THREE.SphereGeometry(0.135, 12, 10), jeansMat);
            legGroup.add(hipJoint);

            // Thigh extends straight down along -Y in local space so IK rotation.x directly aims the knee
            const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.112, thighLength, 14), jeansMat);
            thigh.position.set(0, -thighLength * 0.5, 0);
            legGroup.add(thigh);

            const kneeJoint = new THREE.Mesh(new THREE.SphereGeometry(0.112, 12, 10), jeansMat);
            kneeJoint.position.set(0, -thighLength, 0);
            legGroup.add(kneeJoint);

            // Shin group pivots at the knee (0, -thighLength, 0)
            const shinGroup = new THREE.Group();
            shinGroup.position.set(0, -thighLength, 0);

            const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.108, 0.086, shinLength * 0.82, 14), jeansMat);
            shin.position.set(0, -shinLength * 0.41, 0);
            shinGroup.add(shin);

            // Rolled denim cuff & 1980s white athletic sock above the ankle
            const denimCuff = new THREE.Mesh(new THREE.TorusGeometry(0.092, 0.022, 8, 14), jeansMat);
            denimCuff.rotation.x = Math.PI / 2;
            denimCuff.position.set(0, -shinLength * 0.78, 0);
            shinGroup.add(denimCuff);

            const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.076, shinLength * 0.24, 12), blanketMat);
            sock.position.set(0, -shinLength * 0.88, 0);
            shinGroup.add(sock);

            // Foot group pivots at the ankle (0, -shinLength, 0) so the sneaker stays planted on the pedal
            const footGroup = new THREE.Group();
            footGroup.position.set(0, -shinLength, 0);

            const sneakerUpper = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.10, 0.34), blanketMat);
            sneakerUpper.position.set(0, -0.03, -0.06);
            footGroup.add(sneakerUpper);

            const sneakerStripe = new THREE.Mesh(new THREE.BoxGeometry(0.178, 0.032, 0.22), hoodieRedMat);
            sneakerStripe.position.set(0, -0.025, -0.05);
            footGroup.add(sneakerStripe);

            const sneakerSole = new THREE.Mesh(new THREE.BoxGeometry(0.185, 0.038, 0.36), tireMat);
            sneakerSole.position.set(0, -0.075, -0.06);
            footGroup.add(sneakerSole);

            shinGroup.add(footGroup);
            legGroup.add(shinGroup);
            bikeRoot.add(legGroup);
            return {
                legGroup,
                shinGroup,
                footGroup,
                hipY,
                hipZ,
                thighLength,
                shinLength,
                armPhase
            };
        };

        const leftLeg = buildRiderLeg(leftLegGroup, -1, Math.PI);
        const rightLeg = buildRiderLeg(rightLegGroup, 1, 0);

        this.avatarAnimParts = {
            frontWheel,
            rearWheel,
            crankPivot,
            leftPedal,
            rightPedal,
            bbY,
            bbZ,
            crankRadius,
            leftLeg,
            rightLeg,
            etHeadGroup,
            glowingFingerTip,
            heartLightMesh,
            riderTorso
        };

        // Initialize the crank, pedals, and legs in a natural mid-stroke pedaling pose
        this.updateEtBikePedaling(-0.45);

        this.etBikeRig = window.LoopKickerJourneyAvatarModels.createAvatarFlightState({
            bikeRoot,
            riderTorso,
            torsoBaseRotX: riderTorso.rotation.x,
            etHead: etHeadGroup,
            etHeadBaseY: etHeadGroup.position.y,
            frontWheel,
            rearWheel,
            standing: 0,
            wheelSpin: 0
        });

        this.dragonGroup.position.set(0, this.dragonCurrentY, 0);
        this.scene.add(this.dragonGroup);
    },

    /**
     * Procedural high-contrast brushed 304 stainless steel panel texture for the DeLorean DMC-12.
     * Features fine horizontal hairline grain, anisotropic metallic sheen, and subtle panel seam lines.
     */
    createDeLoreanBrushedSteelTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Anisotropic multi-stop metallic stainless steel gradient
        const grad = ctx.createLinearGradient(0, 0, 512, 512);
        grad.addColorStop(0.0, '#e2e8f0');
        grad.addColorStop(0.22, '#cbd5e1');
        grad.addColorStop(0.48, '#94a3b8');
        grad.addColorStop(0.72, '#f1f5f9');
        grad.addColorStop(1.0, '#cbd5e1');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 512);

        // Dense horizontal brushed stainless hairline grain
        for (let i = 0; i < 2400; i++) {
            const y = (i / 2400) * 512 + (Math.sin(i * 19.7) * 0.8);
            const alpha = 0.08 + (i % 5) * 0.028;
            ctx.strokeStyle = (i % 2 === 0)
                ? `rgba(255, 255, 255, ${alpha})`
                : `rgba(15, 23, 42, ${alpha * 0.85})`;
            ctx.lineWidth = (i % 7 === 0) ? 1.4 : 0.8;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(512, y);
            ctx.stroke();
        }

        // Subtle Giugiaro body panel seam lines and brushed specular bands
        [128, 256, 384].forEach((seamY) => {
            ctx.strokeStyle = 'rgba(15, 23, 42, 0.32)';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(0, seamY);
            ctx.lineTo(512, seamY);
            ctx.stroke();

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.lineWidth = 1.0;
            ctx.beginPath();
            ctx.moveTo(0, seamY + 2);
            ctx.lineTo(512, seamY + 2);
            ctx.stroke();
        });

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.needsUpdate = true;
        return tex;
    },

    /**
     * Procedural iconic California "OUTATIME" license plate texture (with red 'CALIFORNIA' script,
     * blue/gold registration stickers, and bold blue 'OUTATIME' typography).
     */
    createOutatimeLicensePlateTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        // Reflective white/cream California plate background with golden sunburst header band
        ctx.fillStyle = '#fefce8';
        ctx.fillRect(0, 0, 256, 128);

        // Outer dark border & mounting bolt holes
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 6;
        ctx.strokeRect(4, 4, 248, 120);

        // Golden-orange California sunset stripe along top
        const topGrad = ctx.createLinearGradient(0, 10, 0, 42);
        topGrad.addColorStop(0.0, '#f59e0b');
        topGrad.addColorStop(1.0, '#fef08a');
        ctx.fillStyle = topGrad;
        ctx.fillRect(10, 10, 236, 30);

        // Registration month/year corner tags
        ctx.fillStyle = '#2563eb';
        ctx.fillRect(16, 14, 34, 18);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(206, 14, 34, 18);

        // Red "CALIFORNIA" header text
        ctx.fillStyle = '#dc2626';
        ctx.font = 'bold italic 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CALIFORNIA', 128, 33);

        // Bold navy-blue "OUTATIME" stamped characters
        ctx.fillStyle = '#1e3a8a';
        ctx.font = 'bold 38px monospace';
        ctx.fillText('OUTATIME', 128, 88);

        // Bottom "THE GOLDEN STATE" stripe
        ctx.fillStyle = '#dc2626';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('THE GOLDEN STATE', 128, 112);

        const tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
        return tex;
    },

    /**
     * Procedural Back to the Future Time Circuits 3-row LED display texture
     * (Red: DESTINATION TIME OCT 21 2015, Green: PRESENT TIME OCT 26 1985, Amber: LAST TIME DEPARTED NOV 05 1955).
     */
    createTimeCircuitsDisplayTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 192;
        const ctx = canvas.getContext('2d');

        // Dark brushed metal control box face
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, 256, 192);
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, 250, 186);

        const rows = [
            { y: 14, label: 'DESTINATION TIME', text: 'OCT 21 2015 04:29', color: '#ef4444', bg: '#2a0808' },
            { y: 74, label: 'PRESENT TIME', text: 'OCT 26 1985 01:21', color: '#22c55e', bg: '#052e16' },
            { y: 134, label: 'LAST TIME DEPARTED', text: 'NOV 05 1955 06:00', color: '#f59e0b', bg: '#2e1a05' }
        ];

        rows.forEach((r) => {
            // Dymo-style embossed red/black label strip
            ctx.fillStyle = '#991b1b';
            ctx.fillRect(16, r.y, 224, 15);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(r.label, 128, r.y + 11);

            // Recessed 7-segment LED display window
            ctx.fillStyle = r.bg;
            ctx.fillRect(14, r.y + 17, 228, 30);
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 2;
            ctx.strokeRect(14, r.y + 17, 228, 30);

            ctx.fillStyle = r.color;
            ctx.font = 'bold 19px monospace';
            ctx.fillText(r.text, 128, r.y + 39);
        });

        const tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
        return tex;
    },

    /**
     * Builds the DeLorean DMC-12 Time Machine from Back to the Future (Part II Hover Conversion).
     * Features sculpted Giugiaro stainless-steel wedge bodywork, creased hood with DMC grille, gull-wing
     * door seams & toll-booth windows, detailed cabin with Doc & Marty, glowing Y-shaped Flux Capacitor,
     * 3-row LED Time Circuits & 88 MPH speedometer, braided Flux Bands with glowing blue emitter blocks,
     * articulated gold-rimmed hover turbine wheels, twin polygonal nuclear exhaust vents, Mr. Fusion
     * Home Energy Reactor, and animated 1.21-gigawatt temporal plasma coils.
     */
    buildBackToTheFutureDeLorean() {
        this.dragonGroup = new THREE.Group();

        // Helper to organically sculpt sphere/cylinder/box vertices and recompute smooth normals
        const sculptGeometry = (geo, deformFn) => {
            const pos = geo.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                const vx = pos.getX(i);
                const vy = pos.getY(i);
                const vz = pos.getZ(i);
                const [nx, ny, nz] = deformFn(vx, vy, vz);
                pos.setXYZ(i, nx, ny, nz);
            }
            pos.needsUpdate = true;
            geo.computeVertexNormals();
            return geo;
        };

        const addTube = (parent, p1, p2, r, mat) => {
            const v1 = new THREE.Vector3(...p1);
            const v2 = new THREE.Vector3(...p2);
            const dir = new THREE.Vector3().subVectors(v2, v1);
            const len = dir.length();
            const geo = new THREE.CylinderGeometry(r, r, len, 10);
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.copy(v1).add(v2).multiplyScalar(0.5);
            mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
            parent.add(mesh);
            return mesh;
        };

        const steelTex = (this.createDeLoreanBrushedSteelTexture || window.LoopKickerJourneyAvatarModels.createDeLoreanBrushedSteelTexture).call(this);
        const plateTex = (this.createOutatimeLicensePlateTexture || window.LoopKickerJourneyAvatarModels.createOutatimeLicensePlateTexture).call(this);
        const timeCircuitsTex = (this.createTimeCircuitsDisplayTexture || window.LoopKickerJourneyAvatarModels.createTimeCircuitsDisplayTexture).call(this);

        const stainlessMat = new THREE.MeshPhongMaterial({
            color: 0xaeb6bf,
            map: steelTex,
            bumpMap: steelTex,
            bumpScale: 0.032,
            specular: 0xe2e8f0,
            shininess: 110
        });
        const chromeMat = new THREE.MeshPhongMaterial({
            color: 0xf8fafc,
            specular: 0xffffff,
            shininess: 200
        });
        const bumperTrimMat = new THREE.MeshPhongMaterial({
            color: 0x1e293b,
            specular: 0x64748b,
            shininess: 55
        });
        const darkChassisMat = new THREE.MeshPhongMaterial({
            color: 0x0f172a,
            specular: 0x334155,
            shininess: 40
        });
        const glassMat = new THREE.MeshPhongMaterial({
            color: 0x0b1220,
            emissive: 0x020617,
            specular: 0xcbd5e1,
            shininess: 195,
            transparent: true,
            opacity: 0.62
        });
        const fluxBandSteelMat = new THREE.MeshPhongMaterial({
            color: 0xe2e8f0,
            specular: 0xffffff,
            shininess: 190
        });
        const copperCableMat = new THREE.MeshPhongMaterial({
            color: 0xd97706,
            emissive: 0x451a03,
            specular: 0xfde68a,
            shininess: 140
        });
        const redCableMat = new THREE.MeshPhongMaterial({
            color: 0xdc2626,
            emissive: 0x450a0a,
            specular: 0xfca5a5,
            shininess: 110
        });
        const goldRimMat = new THREE.MeshPhongMaterial({
            color: 0xfacc15,
            emissive: 0x422006,
            specular: 0xfef08a,
            shininess: 160
        });
        const fluxBandMat = new THREE.MeshBasicMaterial({
            color: 0x7dd3fc
        });
        const thrusterGlowMat = new THREE.MeshBasicMaterial({
            color: 0x22d3ee,
            transparent: true,
            opacity: 0.92
        });
        const fluxCapacitorGlowMat = new THREE.MeshBasicMaterial({
            color: 0xfef08a
        });

        const carGroup = new THREE.Group();
        carGroup.scale.set(1.22, 1.22, 1.22);
        this.dragonGroup.add(carGroup);

        // 1. Giugiaro Wedge Body built from true DMC-12 side profiles. Profiles are drawn in the car's (z, y)
        // side plane, extruded across the width (X) and pinched per vertex for the tapered flanks & greenhouse.
        const profileShape = (pts) => {
            const s = new THREE.Shape();
            pts.forEach(([pz, py], i) => (i === 0 ? s.moveTo(-pz, py) : s.lineTo(-pz, py)));
            s.closePath();
            return s;
        };
        const extrudeAcross = (shape, depth, mat, halfWidthFn) => {
            const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 14 });
            geo.translate(0, 0, -depth / 2);
            geo.rotateY(Math.PI / 2);
            sculptGeometry(geo, (x, y, z) => [(x / (depth / 2)) * halfWidthFn(y, z), y, z]);
            return new THREE.Mesh(geo, mat);
        };

        const WHEEL_Z = 2.18;
        const ARCH_R = 0.74;
        const SILL_Y = -0.50;
        const bodyHalfWidth = (y, z) => {
            const tumblehome = 1 - Math.max(0, y) * 0.08;
            const nose = z < -3.1 ? 1 - (-3.1 - z) * 0.10 : 1;
            const tail = z > 3.25 ? 1 - (z - 3.25) * 0.08 : 1;
            return 1.64 * tumblehome * nose * tail;
        };
        const greenhouseHalfWidth = (y) => 1.50 - Math.max(0, y - 0.44) * 0.48;

        // Lower body: low knife-edge nose, long flat wedge hood, flat rear deck and cut-out wheel arches
        const bodyShape = new THREE.Shape();
        bodyShape.moveTo(3.64, SILL_Y);
        bodyShape.lineTo(3.72, -0.30);
        bodyShape.lineTo(3.76, -0.02);
        bodyShape.lineTo(3.68, 0.09);
        bodyShape.lineTo(1.60, 0.45);
        bodyShape.lineTo(-2.80, 0.53);
        bodyShape.lineTo(-3.66, 0.48);
        bodyShape.lineTo(-3.74, 0.30);
        bodyShape.lineTo(-3.74, -0.30);
        bodyShape.lineTo(-3.64, SILL_Y);
        bodyShape.absarc(-WHEEL_Z, SILL_Y, ARCH_R, Math.PI, 0, true);
        bodyShape.absarc(WHEEL_Z, SILL_Y, ARCH_R, Math.PI, 0, true);
        bodyShape.closePath();
        const lowerBody = extrudeAcross(bodyShape, 3.20, stainlessMat, bodyHalfWidth);
        carGroup.add(lowerBody);

        // Underbody dark belly pan
        const underbodyPan = new THREE.Mesh(new THREE.BoxGeometry(2.95, 0.10, 6.9), darkChassisMat);
        underbodyPan.position.set(0, -0.55, 0);
        carGroup.add(underbodyPan);

        // Hood centre crease
        const hoodCrease = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.015, 1.9), darkChassisMat);
        hoodCrease.position.set(0, 0.28, -2.64);
        hoodCrease.rotation.x = -Math.atan2(0.36, 2.08);
        carGroup.add(hoodCrease);

        // Dark wheel wells with thin black arch lips
        [-WHEEL_Z, WHEEL_Z].forEach((wz) => {
            const wheelWellDark = new THREE.Mesh(
                new THREE.CylinderGeometry(ARCH_R - 0.02, ARCH_R - 0.02, 2.9, 20, 1, false, 0, Math.PI),
                darkChassisMat
            );
            wheelWellDark.rotation.z = Math.PI / 2;
            wheelWellDark.position.set(0, SILL_Y, wz);
            carGroup.add(wheelWellDark);

            [-1, 1].forEach((side) => {
                const archLip = new THREE.Mesh(new THREE.TorusGeometry(ARCH_R, 0.035, 8, 20, Math.PI), bumperTrimMat);
                archLip.rotation.y = side * (Math.PI / 2);
                archLip.position.set(side * (bodyHalfWidth(0, wz) - 0.01), SILL_Y, wz);
                carGroup.add(archLip);
            });
        });

        // Black side rubbing strips at the beltline crease (interrupted by the wheel arches)
        [-1, 1].forEach((side) => {
            [[-3.30, -2.80], [-1.58, 1.58], [2.80, 3.45]].forEach(([z0, z1]) => {
                const zc = (z0 + z1) / 2;
                const strip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.10, z1 - z0), bumperTrimMat);
                strip.position.set(side * (bodyHalfWidth(0, zc) + 0.02), -0.02, zc);
                carGroup.add(strip);
            });
        });

        // Black polyurethane front fascia: grille band with quad lamps above the bumper
        const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(2.98, 0.32, 0.20), bumperTrimMat);
        frontBumper.position.set(0, -0.32, -3.66);
        carGroup.add(frontBumper);

        const frontAirDam = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.10, 0.30), darkChassisMat);
        frontAirDam.position.set(0, -0.52, -3.52);
        carGroup.add(frontAirDam);

        const dmcGrille = new THREE.Mesh(new THREE.BoxGeometry(2.86, 0.22, 0.08), darkChassisMat);
        dmcGrille.position.set(0, -0.01, -3.74);
        carGroup.add(dmcGrille);

        const dmcSlash = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.035, 0.03), chromeMat);
        dmcSlash.position.set(0, -0.01, -3.79);
        dmcSlash.rotation.z = 0.40;
        carGroup.add(dmcSlash);

        const dmcBadge = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.07, 0.03), chromeMat);
        dmcBadge.position.set(0, -0.01, -3.80);
        carGroup.add(dmcBadge);

        const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(2.98, 0.34, 0.20), bumperTrimMat);
        rearBumper.position.set(0, -0.33, 3.68);
        carGroup.add(rearBumper);

        // 2. Gull-Wing Greenhouse: steep raked windshield, short roof, dark glass, black pillars & louvered fastback
        const greenhouse = extrudeAcross(
            profileShape([[-1.60, 0.44], [-0.36, 1.10], [0.74, 1.12], [0.74, 0.44]]),
            3.0, glassMat, (y) => greenhouseHalfWidth(y)
        );
        carGroup.add(greenhouse);

        const fastback = extrudeAcross(
            profileShape([[0.72, 0.44], [0.72, 1.12], [1.02, 1.11], [2.82, 0.53], [2.82, 0.44]]),
            3.0, stainlessMat, (y) => greenhouseHalfWidth(y)
        );
        carGroup.add(fastback);

        const cabinTopRoof = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.05, 1.12), stainlessMat);
        cabinTopRoof.position.set(0, 1.135, 0.22);
        carGroup.add(cabinTopRoof);

        // Central gull-wing door roof hinge seam
        const gullWingRoofSeam = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 1.12), bumperTrimMat);
        gullWingRoofSeam.position.set(0, 1.165, 0.22);
        carGroup.add(gullWingRoofSeam);

        [-0.55, 0.45].forEach((wx) => {
            const wiper = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.03, 0.04), bumperTrimMat);
            wiper.position.set(wx, 0.49, -1.50);
            wiper.rotation.y = 0.12;
            carGroup.add(wiper);
        });

        [-1, 1].forEach((side) => {
            const gx = (y) => side * (greenhouseHalfWidth(y) + 0.01);
            // Black A-pillars & windshield surround, stainless roof rails, black B-pillar and window beltline
            addTube(carGroup, [gx(0.45), 0.45, -1.58], [gx(1.10), 1.11, -0.36], 0.045, bumperTrimMat);
            addTube(carGroup, [gx(1.11), 1.12, -0.36], [gx(1.12), 1.12, 0.76], 0.04, stainlessMat);
            addTube(carGroup, [gx(0.45), 0.45, 0.74], [gx(1.12), 1.12, 0.74], 0.04, bumperTrimMat);
            addTube(carGroup, [gx(0.45), 0.46, -1.56], [gx(0.45), 0.46, 0.74], 0.035, bumperTrimMat);

            // DMC-12 iconic small "toll-booth" drop window inset in the door glass
            const tb = [[0.54, -0.98], [0.76, -0.98], [0.76, -0.30], [0.54, -0.30]];
            tb.forEach(([y0, z0], i) => {
                const [y1, z1] = tb[(i + 1) % tb.length];
                addTube(carGroup, [gx(y0), y0, z0], [gx(y1), y1, z1], 0.018, bumperTrimMat);
            });

            const doorHandle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.22), bumperTrimMat);
            doorHandle.position.set(side * (bodyHalfWidth(0.30, 0.4) + 0.01), 0.30, 0.40);
            carGroup.add(doorHandle);

            // Black door mirrors near the A-pillar base
            addTube(carGroup, [gx(0.48), 0.48, -1.22], [side * 1.70, 0.54, -1.22], 0.025, bumperTrimMat);
            const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.17, 0.20), bumperTrimMat);
            mirror.position.set(side * 1.78, 0.56, -1.22);
            carGroup.add(mirror);

            const mirrorGlass = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.02), chromeMat);
            mirrorGlass.position.set(side * 1.78, 0.56, -1.11);
            carGroup.add(mirrorGlass);
        });

        // 3. Detailed Interior Cockpit: Dashboard, Time Circuits LED Display, 88 MPH Speedo, Flux Capacitor & Doc/Marty
        const cockpitGroup = new THREE.Group();
        carGroup.add(cockpitGroup);

        // Dashboard Binnacle & Center Console
        const dashBoard = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.38, 0.68), darkChassisMat);
        dashBoard.position.set(0, 0.42, -1.05);
        cockpitGroup.add(dashBoard);

        // Glowing 3-Row Time Circuits Display Module (Red 2015 / Green 1985 / Amber 1955) on Center Dash
        const timeCircuitMat = new THREE.MeshBasicMaterial({ map: timeCircuitsTex });
        const timeCircuitsBox = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.38, 0.34), timeCircuitMat);
        timeCircuitsBox.position.set(0.04, 0.64, -0.88);
        timeCircuitsBox.rotation.x = -0.22;
        cockpitGroup.add(timeCircuitsBox);

        // 88 MPH Digital Speedometer Box perched atop Driver's Binnacle + Plutonium Chamber Gauges
        const speedoBox = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.24), bumperTrimMat);
        speedoBox.position.set(-0.56, 0.68, -1.02);
        cockpitGroup.add(speedoBox);
        const speedoScreen = new THREE.Mesh(
            new THREE.BoxGeometry(0.26, 0.12, 0.04),
            new THREE.MeshBasicMaterial({ color: 0xef4444 })
        );
        speedoScreen.position.set(-0.56, 0.68, -0.89);
        cockpitGroup.add(speedoScreen);

        const plutoniumGauge = new THREE.Mesh(
            new THREE.BoxGeometry(0.42, 0.16, 0.22),
            new THREE.MeshBasicMaterial({ color: 0xfacc15 })
        );
        plutoniumGauge.position.set(0.56, 0.64, -0.96);
        cockpitGroup.add(plutoniumGauge);

        // Driver Steering Wheel
        const steeringWheel = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.032, 8, 18), bumperTrimMat);
        steeringWheel.position.set(-0.58, 0.48, -0.68);
        steeringWheel.rotation.x = -0.35;
        cockpitGroup.add(steeringWheel);

        // Leather Bucket Seats + Doc Brown & Marty McFly Silhouettes inside the Cabin
        const seatMat = new THREE.MeshPhongMaterial({ color: 0x334155, shininess: 35 });
        const martyVestMat = new THREE.MeshPhongMaterial({ color: 0xea580c, shininess: 45 });
        const docSuitMat = new THREE.MeshPhongMaterial({ color: 0xfef3c7, shininess: 40 });
        const skinMat = new THREE.MeshPhongMaterial({ color: 0xfdba74, shininess: 40 });

        [-0.58, 0.58].forEach((sx, idx) => {
            const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.78, 0.18), seatMat);
            seatBack.position.set(sx, 0.46, 0.34);
            seatBack.rotation.x = -0.14;
            cockpitGroup.add(seatBack);

            // Driver (Marty in orange puffer vest) & Passenger (Doc Brown with wild white hair & visor glasses)
            const torso = new THREE.Mesh(
                new THREE.CylinderGeometry(0.22, 0.26, 0.52, 12),
                idx === 0 ? martyVestMat : docSuitMat
            );
            torso.position.set(sx, 0.44, 0.12);
            cockpitGroup.add(torso);

            const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), skinMat);
            head.position.set(sx, 0.78, 0.10);
            cockpitGroup.add(head);

            if (idx === 0) {
                // Marty's brown hair / futuristic cap
                const cap = new THREE.Mesh(
                    new THREE.SphereGeometry(0.19, 10, 10),
                    new THREE.MeshPhongMaterial({ color: 0x451a03, shininess: 60 })
                );
                cap.scale.set(1.02, 0.82, 1.05);
                cap.position.set(sx, 0.84, 0.12);
                cockpitGroup.add(cap);
            } else {
                // Doc Brown's iconic wild white hair & silver 2015 wrap-around visor shades
                const docHair = new THREE.Mesh(
                    new THREE.SphereGeometry(0.23, 12, 10),
                    new THREE.MeshPhongMaterial({ color: 0xf8fafc, shininess: 30 })
                );
                docHair.scale.set(1.28, 0.92, 1.12);
                docHair.position.set(sx, 0.84, 0.15);
                cockpitGroup.add(docHair);

                const docVisor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.065, 0.08), chromeMat);
                docVisor.position.set(sx, 0.79, -0.06);
                cockpitGroup.add(docVisor);
            }
        });

        // Iconic Glowing Y-Shaped Flux Capacitor mounted on the Rear Cabin Bulkhead between the Seats!
        const fluxBox = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.54, 0.22), bumperTrimMat);
        fluxBox.position.set(0, 0.64, 0.58);
        cockpitGroup.add(fluxBox);

        const fluxCapacitorGroup = new THREE.Group();
        fluxCapacitorGroup.position.set(0, 0.64, 0.46);
        addTube(fluxCapacitorGroup, [0, 0, 0], [-0.13, 0.16, 0], 0.028, fluxCapacitorGlowMat);
        addTube(fluxCapacitorGroup, [0, 0, 0], [0.13, 0.16, 0], 0.028, fluxCapacitorGlowMat);
        addTube(fluxCapacitorGroup, [0, 0, 0], [0, -0.18, 0], 0.028, fluxCapacitorGlowMat);
        const fluxCenterNode = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), fluxCapacitorGlowMat);
        fluxCapacitorGroup.add(fluxCenterNode);
        cockpitGroup.add(fluxCapacitorGroup);

        // 4. Iconic Black Rear Window Louvers stepped down the stainless fastback
        const louverTop = { y: 1.11, z: 1.02 };
        const louverBottom = { y: 0.53, z: 2.82 };
        const fastbackSlope = Math.atan2(louverTop.y - louverBottom.y, louverBottom.z - louverTop.z);
        const louverMat = new THREE.MeshPhongMaterial({ color: 0x111111, specular: 0x222222, shininess: 12 });
        const louverPanel = new THREE.Mesh(
            new THREE.BoxGeometry(2.05, 0.02, Math.hypot(louverBottom.z - louverTop.z, louverTop.y - louverBottom.y) - 0.12),
            louverMat
        );
        louverPanel.position.set(0, (louverTop.y + louverBottom.y) / 2 + 0.015, (louverTop.z + louverBottom.z) / 2);
        louverPanel.rotation.x = fastbackSlope;
        carGroup.add(louverPanel);
        for (let l = 0; l < 10; l++) {
            const t = 0.06 + (l / 9) * 0.86;
            const ly = louverTop.y + (louverBottom.y - louverTop.y) * t;
            const louver = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.03, 0.17), louverMat);
            louver.position.set(0, ly + 0.055, louverTop.z + (louverBottom.z - louverTop.z) * t);
            louver.rotation.x = fastbackSlope + 0.55;
            carGroup.add(louver);
        }

        // 5. Quad Rectangular Headlights in the Black Grille Band, Amber Turn Signals & Ribbed Rear Taillight Grids
        const headlightMat = new THREE.MeshBasicMaterial({ color: 0xfef9c3 });
        const amberSignalMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
        [-1.12, -0.74, 0.74, 1.12].forEach((hx) => {
            const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.04), chromeMat);
            bezel.position.set(hx, -0.01, -3.775);
            carGroup.add(bezel);

            const hl = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.13, 0.04), headlightMat);
            hl.position.set(hx, -0.01, -3.785);
            carGroup.add(hl);
        });
        [-1.05, 1.05].forEach((ax) => {
            const turnSig = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.08, 0.04), amberSignalMat);
            turnSig.position.set(ax, -0.30, -3.77);
            carGroup.add(turnSig);
        });

        // Authentic DMC-12 Multi-Cell Rear Taillight Clusters (Red Brake, Amber Turn, White Reverse) + OUTATIME License Plate
        const tailRedMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
        const tailReverseMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
        [-0.86, 0.86].forEach((tx) => {
            const housing = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.36, 0.06), darkChassisMat);
            housing.position.set(tx, 0.10, 3.75);
            carGroup.add(housing);

            for (let col = -1; col <= 1; col++) {
                const cellX = tx + col * 0.36;
                const redCell = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.13, 0.04), tailRedMat);
                redCell.position.set(cellX, 0.18, 3.77);
                carGroup.add(redCell);

                const lowerMat = (col === 0) ? tailReverseMat : amberSignalMat;
                const lowCell = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.11, 0.04), lowerMat);
                lowCell.position.set(cellX, 0.02, 3.77);
                carGroup.add(lowCell);
            }
        });

        const plateMat = new THREE.MeshBasicMaterial({ map: plateTex });
        const licensePlate = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.30, 0.04), plateMat);
        licensePlate.position.set(0, -0.32, 3.79);
        carGroup.add(licensePlate);

        // 6. Twin Rear Time-Vent Assemblies: stainless housings with stacked slats over a glowing plasma core
        const rearVentClusters = [];
        [-1, 1].forEach((side) => {
            const ventGroup = new THREE.Group();
            ventGroup.position.set(side * 0.98, 0.81, 3.22);

            const ventHousing = new THREE.Mesh(new THREE.BoxGeometry(0.90, 0.56, 0.92), stainlessMat);
            ventGroup.add(ventHousing);

            const ventCap = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.05, 0.98), darkChassisMat);
            ventCap.position.y = 0.30;
            ventGroup.add(ventCap);

            const grilleFrame = new THREE.Mesh(new THREE.BoxGeometry(0.80, 0.46, 0.04), darkChassisMat);
            grilleFrame.position.z = 0.47;
            ventGroup.add(grilleFrame);

            const coreGlow = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.38, 0.03), thrusterGlowMat);
            coreGlow.position.z = 0.49;
            ventGroup.add(coreGlow);
            rearVentClusters.push(coreGlow);

            for (let s = 0; s < 5; s++) {
                const slat = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.035, 0.09), chromeMat);
                slat.position.set(0, -0.18 + s * 0.09, 0.53);
                slat.rotation.x = -0.6;
                ventGroup.add(slat);
            }

            // Ribbed cooling fins on the outboard flank
            for (let f = 0; f < 5; f++) {
                const fin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.44, 0.06), darkChassisMat);
                fin.position.set(side * 0.47, 0, -0.32 + f * 0.16);
                ventGroup.add(fin);
            }

            // Copper & crimson high-voltage conduits running from each vent up into the louvers
            addTube(carGroup, [side * 0.62, 0.95, 2.78], [side * 0.55, 0.98, 2.20], 0.045, copperCableMat);
            addTube(carGroup, [side * 0.70, 0.70, 2.76], [side * 0.82, 0.86, 2.28], 0.04, redCableMat);
            addTube(carGroup, [side * 1.30, 0.62, 2.76], [side * 1.36, 0.60, 2.30], 0.035, copperCableMat);

            carGroup.add(ventGroup);
        });

        // 7. Mr. Fusion Home Energy Reactor on the rear engine deck between the vents
        const reactorDeck = new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.44, 0.10, 20), darkChassisMat);
        reactorDeck.position.set(0, 0.58, 3.14);
        carGroup.add(reactorDeck);

        const mrFusionBase = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.29, 0.30, 18), bumperTrimMat);
        mrFusionBase.position.set(0, 0.78, 3.14);
        carGroup.add(mrFusionBase);

        const mrFusionBody = new THREE.Mesh(
            new THREE.CylinderGeometry(0.19, 0.22, 0.44, 18),
            new THREE.MeshPhongMaterial({ color: 0xf1f5f9, specular: 0xffffff, shininess: 140 })
        );
        mrFusionBody.position.set(0, 1.15, 3.14);
        carGroup.add(mrFusionBody);

        const mrFusionLatch = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.18, 0.08), redCableMat);
        mrFusionLatch.position.set(0, 1.12, 3.35);
        carGroup.add(mrFusionLatch);

        const mrFusionDome = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.20, 0.14, 16), chromeMat);
        mrFusionDome.position.set(0, 1.44, 3.14);
        carGroup.add(mrFusionDome);

        const mrFusionHandle = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.06), bumperTrimMat);
        mrFusionHandle.position.set(0, 1.535, 3.14);
        carGroup.add(mrFusionHandle);

        // 8. Ribbed Chrome Flux Bands along the lower flanks with a glowing blue temporal core line
        const fluxCoilMeshes = [];
        [-1, 1].forEach((side) => {
            [[-3.25, -2.92], [-1.44, 1.44], [2.92, 3.40]].forEach(([z0, z1]) => {
                const len = z1 - z0;
                const zc = (z0 + z1) / 2;
                const bx = side * (bodyHalfWidth(-0.30, zc) + 0.04);

                const band = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.13, len), fluxBandSteelMat);
                band.position.set(bx, -0.30, zc);
                carGroup.add(band);

                const ribs = Math.max(1, Math.round(len / 0.36));
                for (let r = 0; r <= ribs; r++) {
                    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.025), bumperTrimMat);
                    rib.position.set(bx, -0.30, z0 + (r / ribs) * len);
                    carGroup.add(rib);
                }

                const glowLine = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.035, len * 0.98), fluxBandMat);
                glowLine.position.set(bx + side * 0.04, -0.30, zc);
                carGroup.add(glowLine);
                fluxCoilMeshes.push(glowLine);
            });
        });

        // 9. 4 Hover-Converted Horizontally Folded Wheels with Gold Rim Turbines, Hydraulic Struts & Plasma Rings
        const hoverWheelRings = [];
        const wheelCoords = [
            { x: -1.72, z: -2.18 },
            { x: 1.72, z: -2.18 },
            { x: -1.72, z: 2.18 },
            { x: 1.72, z: 2.18 }
        ];
        wheelCoords.forEach((wc) => {
            const wGroup = new THREE.Group();
            wGroup.position.set(wc.x, -0.55, wc.z);
            const inDir = wc.x > 0 ? -1 : 1;

            // Articulated Dual Scissor Hydraulic Hover Strut Arms extending from the wheel well
            const mainStrut = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 0.26), stainlessMat);
            mainStrut.position.set(inDir * 0.26, 0.14, 0);
            wGroup.add(mainStrut);

            addTube(wGroup, [inDir * 0.52, 0.28, -0.14], [0, 0.06, -0.10], 0.038, copperCableMat);
            addTube(wGroup, [inDir * 0.52, 0.28, 0.14], [0, 0.06, 0.10], 0.038, chromeMat);

            // Horizontally folded GoodYear tire (facing downward for BTTF Part II hover mode!)
            const tire = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.22, 14, 28), bumperTrimMat);
            tire.rotation.x = Math.PI / 2;
            wGroup.add(tire);

            // Gold-Anodized Part II Hover Conversion Rim & Finned DMC Turbine Hub
            const goldRimRing = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.055, 10, 24), goldRimMat);
            goldRimRing.rotation.x = Math.PI / 2;
            goldRimRing.position.y = 0.06;
            wGroup.add(goldRimRing);

            const hubDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.18, 20), stainlessMat);
            wGroup.add(hubDisc);

            // 12 Radial DMC Turbine Vanes on the Wheel Hub
            for (let v = 0; v < 12; v++) {
                const vAng = (v / 12) * Math.PI * 2;
                const vane = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.21, 0.38), chromeMat);
                vane.position.set(Math.sin(vAng) * 0.24, 0.02, Math.cos(vAng) * 0.24);
                vane.rotation.y = vAng;
                wGroup.add(vane);
            }

            // Concentric Glowing Cyan Hover Thruster Ring & Inner Plasma Core under each wheel
            const glowRing = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.095, 12, 28), thrusterGlowMat);
            glowRing.rotation.x = Math.PI / 2;
            glowRing.position.y = -0.14;
            wGroup.add(glowRing);

            const innerPlasmaDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.18, 0.08, 18), fluxBandMat);
            innerPlasmaDisc.position.y = -0.12;
            glowRing.add(innerPlasmaDisc);

            hoverWheelRings.push(glowRing);
            carGroup.add(wGroup);
        });

        this.avatarAnimParts = {
            carGroup,
            hoverWheelRings,
            rearVentClusters,
            fluxCoilMeshes,
            fluxCapacitorGroup,
            fluxBandMat,
            thrusterGlowMat
        };

        carGroup.rotation.order = 'YXZ';
        this.deloreanRig = window.LoopKickerJourneyAvatarModels.createAvatarFlightState({
            carGroup,
            baseY: carGroup.position.y,
            wheels: hoverWheelRings.map((ring) => ({ obj: ring.parent, front: ring.parent.position.z < 0 })),
            rearVentClusters,
            thrusterGlowMat,
            effortSlow: 0
        });

        this.dragonGroup.position.set(0, this.dragonCurrentY, 0);
        this.scene.add(this.dragonGroup);
    },

    /**
     * Procedural mirror-polished 1950s fluted chrome & concentric Art-Deco saucer hull texture for Mars Attacks! UFO.
     */
    createMarsAttacksChromeHullTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        const cx = 256;
        const cy = 256;

        // High-contrast liquid-silver radial chrome gradient
        const radGrad = ctx.createRadialGradient(cx, cy, 8, cx, cy, 256);
        radGrad.addColorStop(0.0, '#ffffff');
        radGrad.addColorStop(0.18, '#f1f5f9');
        radGrad.addColorStop(0.38, '#cbd5e1');
        radGrad.addColorStop(0.55, '#94a3b8');
        radGrad.addColorStop(0.72, '#e2e8f0');
        radGrad.addColorStop(0.88, '#64748b');
        radGrad.addColorStop(1.0, '#1e293b');
        ctx.fillStyle = radGrad;
        ctx.fillRect(0, 0, 512, 512);

        // 36 Radial fluted saucer ribs & metallic specular wedge highlights (classic Mars Attacks! molded saucer look)
        const numFlutes = 36;
        for (let i = 0; i < numFlutes; i++) {
            const a0 = (i / numFlutes) * Math.PI * 2;
            const a1 = ((i + 0.5) / numFlutes) * Math.PI * 2;
            ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 255, 255, 0.16)' : 'rgba(15, 23, 42, 0.14)';
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, 254, a0, a1);
            ctx.closePath();
            ctx.fill();

            // Crisp radial seam line
            ctx.strokeStyle = 'rgba(15, 23, 42, 0.38)';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a0) * 34, cy + Math.sin(a0) * 34);
            ctx.lineTo(cx + Math.cos(a0) * 254, cy + Math.sin(a0) * 254);
            ctx.stroke();

            // Rivet pairs along each radial seam
            [82, 134, 184, 228].forEach((r) => {
                const rx = cx + Math.cos(a0 + 0.03) * r;
                const ry = cy + Math.sin(a0 + 0.03) * r;
                ctx.fillStyle = 'rgba(30, 41, 59, 0.55)';
                ctx.beginPath();
                ctx.arc(rx, ry, 2.2, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        // Concentric stepped Art-Deco trim rings
        [52, 96, 146, 196, 236, 248].forEach((r, idx) => {
            ctx.strokeStyle = idx % 2 === 0 ? 'rgba(255, 255, 255, 0.55)' : 'rgba(15, 23, 42, 0.45)';
            ctx.lineWidth = idx === 4 ? 3.2 : 2.0;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();
        });

        const tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
        return tex;
    },

    /**
     * Procedural convoluted pink-crimson Martian brain sulci & gyri texture for the Mars Attacks! pilot.
     */
    createMartianBrainTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        const baseGrad = ctx.createLinearGradient(0, 0, 256, 256);
        baseGrad.addColorStop(0.0, '#fbcfe8');
        baseGrad.addColorStop(0.5, '#f5b5c8');
        baseGrad.addColorStop(1.0, '#e79aae');
        ctx.fillStyle = baseGrad;
        ctx.fillRect(0, 0, 256, 256);

        // Winding cerebral folds (gyri highlights and deep dark-crimson sulci)
        for (let i = 0; i < 68; i++) {
            const x0 = (Math.sin(i * 41.3) * 0.5 + 0.5) * 256;
            const y0 = (Math.cos(i * 67.9) * 0.5 + 0.5) * 256;
            const cx1 = x0 + Math.cos(i * 2.1) * 42;
            const cy1 = y0 + Math.sin(i * 1.7) * 42;
            const x1 = x0 + Math.sin(i * 3.3) * 58;
            const y1 = y0 + Math.cos(i * 2.9) * 58;

            // Thick pinkish-white gyrus ridge
            ctx.strokeStyle = 'rgba(255, 241, 242, 0.5)';
            ctx.lineWidth = 9;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.quadraticCurveTo(cx1, cy1, x1, y1);
            ctx.stroke();

            // Deep dark-burgundy sulcus crease
            ctx.strokeStyle = 'rgba(136, 19, 55, 0.6)';
            ctx.lineWidth = 3.2;
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.quadraticCurveTo(cx1, cy1, x1, y1);
            ctx.stroke();
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        return tex;
    },

    /**
     * Builds the UFO from Mars Attacks! (classic 1950s/Tim Burton retro-futuristic chrome flying saucer
     * with smooth LatheGeometry Art-Deco stepped concentric hull tiers, fluted radial ribs, glowing perimeter
     * slots & domes, ventral central gravity sphere with 3 landing hemisphere pods, cockpit control console
     * with steering yoke & brain-wave screen, detailed Martian Leader/Pilot with oversized convoluted brain,
     * skull-like grin, red cape & high gold collar, clear helmet, glass cockpit dome with top ray-fin spire,
     * and twin articulated retro-futuristic coil-ring disintegrator ray cannons).
     */
    buildMarsAttacksUfo() {
        this.dragonGroup = new THREE.Group();

        const hullTex = (this.createMarsAttacksChromeHullTexture || window.LoopKickerJourneyAvatarModels.createMarsAttacksChromeHullTexture).call(this);
        const brainTex = (this.createMartianBrainTexture || window.LoopKickerJourneyAvatarModels.createMartianBrainTexture).call(this);

        const saucerChromeMat = new THREE.MeshPhongMaterial({
            color: 0xa3adb8,
            map: hullTex,
            bumpMap: hullTex,
            bumpScale: 0.04,
            specular: 0xe2e8f0,
            shininess: 110
        });
        const mirrorChromeMat = new THREE.MeshPhongMaterial({
            color: 0xf8fafc,
            specular: 0xffffff,
            shininess: 200
        });
        const darkTrimMat = new THREE.MeshPhongMaterial({
            color: 0x334155,
            specular: 0x94a3b8,
            shininess: 135
        });
        const domeGlassMat = new THREE.MeshPhongMaterial({
            color: 0xdbeafe,
            emissive: 0x082f49,
            emissiveIntensity: 0.35,
            specular: 0xffffff,
            shininess: 200,
            transparent: true,
            opacity: 0.34
        });
        const helmetGlassMat = new THREE.MeshPhongMaterial({
            color: 0xe0f2fe,
            specular: 0xffffff,
            shininess: 195,
            transparent: true,
            opacity: 0.28
        });
        const martianBrainMat = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            map: brainTex,
            bumpMap: brainTex,
            bumpScale: 0.07,
            emissive: 0x2a0a14,
            specular: 0xffe4e6,
            shininess: 70
        });
        const martianSkinMat = new THREE.MeshPhongMaterial({
            color: 0xb8cf9a,
            emissive: 0x16240a,
            specular: 0xecfccb,
            shininess: 45
        });
        const martianArmorMat = new THREE.MeshPhongMaterial({
            color: 0x2f855a,
            emissive: 0x052e16,
            specular: 0xbbf7d0,
            shininess: 120
        });
        const martianSuitRedMat = new THREE.MeshPhongMaterial({
            color: 0xdc2626,
            emissive: 0x450a0a,
            specular: 0xfca5a5,
            shininess: 90,
            side: THREE.DoubleSide
        });
        const martianGoldMat = new THREE.MeshPhongMaterial({
            color: 0xfacc15,
            emissive: 0x422006,
            specular: 0xfef08a,
            shininess: 150
        });
        const greenPlasmaMat = new THREE.MeshBasicMaterial({
            color: 0x4ade80
        });
        const redPlasmaMat = new THREE.MeshBasicMaterial({
            color: 0xf43f5e
        });
        const cyanPlasmaMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8
        });

        const ufoRoot = new THREE.Group();
        this.dragonGroup.add(ufoRoot);

        // 1. Rotating Outer Saucer Disc Group
        const spinningDiscGroup = new THREE.Group();
        ufoRoot.add(spinningDiscGroup);

        // Wide, flat 1950s Mars Attacks! saucer: thin knife-edge rim, gently sloped upper deck and
        // a low stepped underside, all in polished silver (profile revolved with LatheGeometry).
        const RIM_R = 6.2;
        const lathePoints = [
            new THREE.Vector2(0.0, -0.50),
            new THREE.Vector2(2.05, -0.50),
            new THREE.Vector2(2.15, -0.42),
            new THREE.Vector2(3.55, -0.36),
            new THREE.Vector2(3.65, -0.28),
            new THREE.Vector2(5.05, -0.17),
            new THREE.Vector2(5.95, -0.08),
            new THREE.Vector2(RIM_R, -0.04),
            new THREE.Vector2(RIM_R, 0.04),
            new THREE.Vector2(5.85, 0.12),
            new THREE.Vector2(4.80, 0.27),
            new THREE.Vector2(3.70, 0.44),
            new THREE.Vector2(3.05, 0.55),
            new THREE.Vector2(2.95, 0.66),
            new THREE.Vector2(2.82, 0.70),
            new THREE.Vector2(0.0, 0.70)
        ];
        const latheHull = new THREE.Mesh(new THREE.LatheGeometry(lathePoints, 72), saucerChromeMat);
        spinningDiscGroup.add(latheHull);

        // Raised concentric chrome rings on the upper deck
        const deckY = (r) => 0.12 + (5.85 - r) * ((0.55 - 0.12) / (5.85 - 3.05));
        [3.35, 4.25, 5.15].forEach((r) => {
            const deckRing = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 8, 72), darkTrimMat);
            deckRing.rotation.x = Math.PI / 2;
            deckRing.position.y = deckY(r) + 0.01;
            spinningDiscGroup.add(deckRing);
        });

        // Dark recessed band around the equator that carries the ring of running lights
        const rimBand = new THREE.Mesh(new THREE.CylinderGeometry(RIM_R + 0.02, RIM_R + 0.02, 0.28, 72, 1, true), darkTrimMat);
        spinningDiscGroup.add(rimBand);

        [0.15, -0.15].forEach((ly) => {
            const chromeLipTorus = new THREE.Mesh(new THREE.TorusGeometry(RIM_R + 0.03, 0.045, 8, 72), mirrorChromeMat);
            chromeLipTorus.rotation.x = Math.PI / 2;
            chromeLipTorus.position.y = ly;
            spinningDiscGroup.add(chromeLipTorus);
        });

        // Chrome collar the dome sits in
        const cockpitBezelRing = new THREE.Mesh(new THREE.TorusGeometry(2.86, 0.12, 12, 64), mirrorChromeMat);
        cockpitBezelRing.rotation.x = Math.PI / 2;
        cockpitBezelRing.position.y = 0.70;
        spinningDiscGroup.add(cockpitBezelRing);

        // Evenly spaced ring of round running lights set into the rim band (classic flashing saucer lights)
        const rimLightMeshes = [];
        const rimLightCount = 32;
        const rimLightColors = [0xfde047, 0x4ade80, 0xfde047, 0xf43f5e];
        for (let i = 0; i < rimLightCount; i++) {
            const angle = (i / rimLightCount) * Math.PI * 2;
            const px = Math.cos(angle) * (RIM_R + 0.04);
            const pz = Math.sin(angle) * (RIM_R + 0.04);

            const orbMat = new THREE.MeshBasicMaterial({ color: rimLightColors[i % rimLightColors.length] });
            const orb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), orbMat);
            orb.position.set(px, 0, pz);
            spinningDiscGroup.add(orb);
            rimLightMeshes.push(orb);
        }

        // Small square portholes around the dome collar step
        for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2 + Math.PI / 16;
            const port = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.04), greenPlasmaMat);
            port.position.set(Math.cos(angle) * 3.02, 0.61, Math.sin(angle) * 3.02);
            port.rotation.y = -angle + Math.PI / 2;
            spinningDiscGroup.add(port);
        }

        // 2. Authentic Mars Attacks! Underside: Central Anti-Gravity Core, Concentric Tractor Rings & 3 Hemispherical Landing Domes
        // Shallow chrome belly dome inside the innermost step, ringed by underside lamps
        const ventralHousing = new THREE.Mesh(
            new THREE.SphereGeometry(1.95, 32, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
            mirrorChromeMat
        );
        ventralHousing.scale.set(1.0, 0.24, 1.0);
        ventralHousing.position.y = -0.48;
        spinningDiscGroup.add(ventralHousing);

        const tractorCore = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 12), greenPlasmaMat);
        tractorCore.scale.set(1.0, 0.4, 1.0);
        tractorCore.position.y = -0.92;
        spinningDiscGroup.add(tractorCore);

        const tractorHalo = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.06, 8, 40), greenPlasmaMat);
        tractorHalo.rotation.x = Math.PI / 2;
        tractorHalo.position.y = -0.85;
        spinningDiscGroup.add(tractorHalo);

        const outerTractorRing = new THREE.Mesh(new THREE.TorusGeometry(2.12, 0.05, 8, 64), redPlasmaMat);
        outerTractorRing.rotation.x = Math.PI / 2;
        outerTractorRing.position.y = -0.48;
        spinningDiscGroup.add(outerTractorRing);

        [3.62, 5.0].forEach((r) => {
            const underRing = new THREE.Mesh(new THREE.TorusGeometry(r, 0.04, 6, 72), darkTrimMat);
            underRing.rotation.x = Math.PI / 2;
            underRing.position.y = r < 4 ? -0.32 : -0.18;
            spinningDiscGroup.add(underRing);
        });

        for (let b = 0; b < 12; b++) {
            const bAng = (b / 12) * Math.PI * 2;
            const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), b % 2 === 0 ? greenPlasmaMat : cyanPlasmaMat);
            lamp.scale.set(1.0, 0.5, 1.0);
            lamp.position.set(Math.cos(bAng) * 2.85, -0.42, Math.sin(bAng) * 2.85);
            spinningDiscGroup.add(lamp);
        }

        // 3. Detailed Cockpit Tub, Martian Control Console, Radar Screen & Steering Yoke
        const cockpitFloor = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 0.1, 48), darkTrimMat);
        cockpitFloor.position.y = 0.70;
        ufoRoot.add(cockpitFloor);

        // Low dark command chair behind the Martian pilot
        const seatBack = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.05, 0.22), darkTrimMat);
        seatBack.position.set(0, 1.25, 0.95);
        seatBack.rotation.x = -0.16;
        ufoRoot.add(seatBack);

        const seatTrim = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.08, 0.3), mirrorChromeMat);
        seatTrim.position.set(0, 1.80, 1.03);
        ufoRoot.add(seatTrim);

        // Low front instrument console & glowing green targeting radar
        const consoleBase = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.42, 0.6), darkTrimMat);
        consoleBase.position.set(0, 0.92, -1.45);
        consoleBase.rotation.x = 0.28;
        ufoRoot.add(consoleBase);

        const radarScreen = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.3, 0.06), greenPlasmaMat);
        radarScreen.position.set(0, 1.08, -1.22);
        radarScreen.rotation.x = -0.6;
        ufoRoot.add(radarScreen);

        [-0.55, -0.38, 0.38, 0.55].forEach((bx, idx) => {
            const btn = new THREE.Mesh(
                new THREE.SphereGeometry(0.065, 8, 8),
                idx % 2 === 0 ? redPlasmaMat : cyanPlasmaMat
            );
            btn.position.set(bx, 1.1, -1.24);
            ufoRoot.add(btn);
        });

        const yokeShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.5, 10), mirrorChromeMat);
        yokeShaft.position.set(0, 1.14, -0.98);
        yokeShaft.rotation.x = -0.45;
        ufoRoot.add(yokeShaft);

        const yokeRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.04, 8, 20, Math.PI * 1.35), mirrorChromeMat);
        yokeRing.position.set(0, 1.32, -0.86);
        yokeRing.rotation.x = 0.35;
        yokeRing.rotation.z = -Math.PI * 0.175;
        ufoRoot.add(yokeRing);

        // 4. Iconic Mars Attacks! Martian Pilot inside the Cockpit ("ACK! ACK!")
        const martianPilotGroup = new THREE.Group();
        martianPilotGroup.position.set(0, 0.72, 0.05);

        // Green ribbed armour suit with a red chest emblem
        const suitTorso = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.85, 0.72, 20), martianArmorMat);
        suitTorso.position.y = 0.32;
        martianPilotGroup.add(suitTorso);

        [0.14, 0.32, 0.5].forEach((ry) => {
            const rib = new THREE.Mesh(new THREE.TorusGeometry(0.8 - ry * 0.32, 0.03, 6, 28), mirrorChromeMat);
            rib.rotation.x = Math.PI / 2;
            rib.position.y = ry;
            martianPilotGroup.add(rib);
        });

        const chestEmblem = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16), martianSuitRedMat);
        chestEmblem.position.set(0, 0.38, -0.74);
        chestEmblem.rotation.set(0.3, Math.PI, 0);
        martianPilotGroup.add(chestEmblem);

        // Tall flared red collar framing the helmet
        const suitCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.6, 0.42, 24, 1, true), martianSuitRedMat);
        suitCollar.position.set(0, 0.72, 0.2);
        suitCollar.rotation.x = -0.35;
        martianPilotGroup.add(suitCollar);

        // Arms with skeletal green hands on the controls
        [-1, 1].forEach((side) => {
            const shoulderPad = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), martianArmorMat);
            shoulderPad.scale.set(1.2, 0.75, 1.0);
            shoulderPad.position.set(side * 0.72, 0.56, -0.02);
            martianPilotGroup.add(shoulderPad);

            const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.75, 10), martianArmorMat);
            arm.position.set(side * 0.5, 0.48, -0.45);
            arm.rotation.x = Math.PI / 2 - 0.25;
            arm.rotation.z = side * 0.38;
            martianPilotGroup.add(arm);

            const hand = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), martianSkinMat);
            hand.scale.set(1.0, 0.7, 1.3);
            hand.position.set(side * 0.24, 0.6, -0.82);
            martianPilotGroup.add(hand);
        });

        // Chrome neck ring sealing the fishbowl helmet
        const neckRing = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.07, 12, 28), mirrorChromeMat);
        neckRing.rotation.x = Math.PI / 2;
        neckRing.position.set(0, 0.7, 0.0);
        martianPilotGroup.add(neckRing);

        // Bony, pale-green skull face (no nose, no lips) under the overhanging brain
        const martianFace = new THREE.Mesh(new THREE.SphereGeometry(0.46, 20, 16), martianSkinMat);
        martianFace.scale.set(0.86, 1.05, 0.86);
        martianFace.position.set(0, 1.12, -0.08);
        martianPilotGroup.add(martianFace);

        const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), martianSkinMat);
        jaw.scale.set(1.0, 0.7, 0.95);
        jaw.position.set(0, 0.84, -0.18);
        martianPilotGroup.add(jaw);

        [-1, 1].forEach((side) => {
            const cheekBone = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), martianSkinMat);
            cheekBone.scale.set(1.2, 0.7, 1.0);
            cheekBone.position.set(side * 0.27, 1.0, -0.33);
            martianPilotGroup.add(cheekBone);
        });

        const nostrilMat = new THREE.MeshBasicMaterial({ color: 0x1a2e05 });
        [-0.045, 0.045].forEach((nx) => {
            const nasalSlit = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.05), nostrilMat);
            nasalSlit.position.set(nx, 1.03, -0.47);
            nasalSlit.rotation.z = nx > 0 ? -0.3 : 0.3;
            martianPilotGroup.add(nasalSlit);
        });

        // Wide lipless grin with two rows of big square teeth
        const mouthCavity = new THREE.Mesh(
            new THREE.CylinderGeometry(0.33, 0.31, 0.2, 18, 1, false, Math.PI - Math.PI * 0.4, Math.PI * 0.8),
            new THREE.MeshBasicMaterial({ color: 0x1c0a0a })
        );
        mouthCavity.position.set(0, 0.87, -0.12);
        martianPilotGroup.add(mouthCavity);

        const toothMat = new THREE.MeshPhongMaterial({ color: 0xfef9c3, specular: 0xffffff, shininess: 140 });
        for (let t = -4; t <= 4; t++) {
            const tAng = t * 0.15;
            const tx = Math.sin(tAng) * 0.34;
            const tz = -0.12 - Math.cos(tAng) * 0.34;
            [0.92, 0.82].forEach((ty) => {
                const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.085, 0.04), toothMat);
                tooth.position.set(tx, ty, tz);
                tooth.rotation.y = -tAng;
                martianPilotGroup.add(tooth);
            });
        }

        // Huge exposed brain: two pale-pink hemispheres split by a deep fissure, bulging up and back
        const brainLeft = new THREE.Mesh(new THREE.SphereGeometry(0.6, 24, 18), martianBrainMat);
        brainLeft.scale.set(0.88, 0.92, 1.25);
        brainLeft.position.set(-0.28, 1.76, 0.12);
        martianPilotGroup.add(brainLeft);

        const brainRight = new THREE.Mesh(new THREE.SphereGeometry(0.6, 24, 18), martianBrainMat);
        brainRight.scale.set(0.88, 0.92, 1.25);
        brainRight.position.set(0.28, 1.76, 0.12);
        martianPilotGroup.add(brainRight);

        [-0.24, 0.24].forEach((bx) => {
            const rearLobe = new THREE.Mesh(new THREE.SphereGeometry(0.44, 18, 14), martianBrainMat);
            rearLobe.scale.set(0.95, 0.9, 1.2);
            rearLobe.position.set(bx, 1.56, 0.62);
            martianPilotGroup.add(rearLobe);
        });

        // Bulging lidless eyes in dark sockets, ringed in red
        const socketMat = new THREE.MeshBasicMaterial({ color: 0x14210a });
        const bulgeEyeMat = new THREE.MeshPhongMaterial({ color: 0xfffbeb, specular: 0xffffff, shininess: 160 });
        const redIrisMat = new THREE.MeshBasicMaterial({ color: 0xb91c1c });
        const blackPupilMat = new THREE.MeshBasicMaterial({ color: 0x020617 });
        [-0.19, 0.19].forEach((ex) => {
            const socket = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 12), socketMat);
            socket.position.set(ex, 1.22, -0.36);
            martianPilotGroup.add(socket);

            const eyeball = new THREE.Mesh(new THREE.SphereGeometry(0.165, 16, 14), bulgeEyeMat);
            eyeball.position.set(ex, 1.22, -0.43);
            martianPilotGroup.add(eyeball);

            const lid = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.028, 8, 20), redIrisMat);
            lid.position.set(ex, 1.22, -0.45);
            martianPilotGroup.add(lid);

            const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), blackPupilMat);
            pupil.position.set(ex, 1.22, -0.57);
            martianPilotGroup.add(pupil);
        });

        // Clear fishbowl helmet enclosing head and brain
        const personalHelmet = new THREE.Mesh(
            new THREE.SphereGeometry(1.0, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.8),
            helmetGlassMat
        );
        personalHelmet.scale.set(1.0, 1.06, 1.0);
        personalHelmet.position.set(0, 1.5, 0.06);
        martianPilotGroup.add(personalHelmet);

        ufoRoot.add(martianPilotGroup);
        this.dragonHeadGroup = martianPilotGroup;

        // 5. Big clear hemispherical cockpit dome with a small chrome apex beacon
        const glassDome = new THREE.Mesh(
            new THREE.SphereGeometry(2.84, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.5),
            domeGlassMat
        );
        glassDome.position.y = 0.70;
        ufoRoot.add(glassDome);

        const apexCap = new THREE.Mesh(
            new THREE.SphereGeometry(0.26, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
            mirrorChromeMat
        );
        apexCap.position.y = 3.5;
        ufoRoot.add(apexCap);

        const antennaBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), redPlasmaMat);
        antennaBeacon.position.y = 3.78;
        ufoRoot.add(antennaBeacon);

        // 6. Chrome ray gun slung under the nose, plus flush red emitter ports either side
        const rayGunMount = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), mirrorChromeMat);
        rayGunMount.position.set(0, -0.42, -3.5);
        ufoRoot.add(rayGunMount);

        const rayBlaster = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.15, 1.3, 14), mirrorChromeMat);
        rayBlaster.rotation.x = -Math.PI / 2;
        rayBlaster.position.set(0, -0.42, -4.15);
        ufoRoot.add(rayBlaster);

        [0, 1, 2].forEach((cIdx) => {
            const barrelRing = new THREE.Mesh(
                new THREE.TorusGeometry(0.17 - cIdx * 0.025, 0.03, 8, 16),
                darkTrimMat
            );
            barrelRing.position.set(0, -0.42, -3.85 - cIdx * 0.3);
            ufoRoot.add(barrelRing);
        });

        const rayTip = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 14), greenPlasmaMat);
        rayTip.position.set(0, -0.42, -4.85);
        ufoRoot.add(rayTip);

        const sideRayTips = [];
        [-1, 1].forEach((side) => {
            const port = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), redPlasmaMat);
            port.scale.set(1.0, 0.5, 1.0);
            port.position.set(side * 2.3, -0.38, -3.0);
            ufoRoot.add(port);
            sideRayTips.push(port);
        });

        this.avatarAnimParts = {
            spinningDiscGroup,
            martianPilotGroup,
            tractorCore,
            tractorHalo,
            outerTractorRing,
            rimLightMeshes,
            rayTip,
            sideRayTips,
            antennaBeacon
        };

        ufoRoot.rotation.order = 'YXZ';
        this.ufoRig = window.LoopKickerJourneyAvatarModels.createAvatarFlightState({
            root: ufoRoot,
            disc: spinningDiscGroup,
            pilot: martianPilotGroup,
            pilotBase: martianPilotGroup.position.clone(),
            spinRate: 0.9
        });

        this.dragonGroup.position.set(0, this.dragonCurrentY, 0);
        this.scene.add(this.dragonGroup);
    },

    /**
     * Procedural Phi Maestro Light 3 sail texture (white cloth with lilac-magenta leading edge, tips,
     * trailing-edge band and saw-tooth chevrons). The canvas wraps the airfoil: top half = upper surface
     * (trailing edge at the top, leading edge in the middle), bottom half = lower surface back to the trailing edge.
     */
    createPhiMaestroWingTexture(cellCount = 52) {
        const W = 4096;
        const H = 1024;
        const MID = H / 2;
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');
        const LILA = '#b4128c';
        const LILA_DARK = '#8a0b6b';
        const xOf = (s) => ((s + 1) / 2) * W;
        const yUpper = (c) => MID - c * MID; // upper surface: c = 0 at LE (y = MID), c = 1 at TE (y = 0)
        const yLower = (c) => MID + c * MID;

        const base = ctx.createLinearGradient(0, 0, 0, H);
        base.addColorStop(0.0, '#f4f3f8');
        base.addColorStop(0.45, '#ffffff');
        base.addColorStop(0.55, '#fbfbfd');
        base.addColorStop(1.0, '#e9e8f0');
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, W, H);

        // Cell billow shading between ribs + crisp rib seams (diagonal ribs show faintly through the cloth)
        const cellW = W / cellCount;
        for (let i = 0; i < cellCount; i++) {
            const x0 = i * cellW;
            const g = ctx.createLinearGradient(x0, 0, x0 + cellW, 0);
            g.addColorStop(0.0, 'rgba(120, 115, 150, 0.16)');
            g.addColorStop(0.18, 'rgba(255, 255, 255, 0.0)');
            g.addColorStop(0.82, 'rgba(255, 255, 255, 0.0)');
            g.addColorStop(1.0, 'rgba(120, 115, 150, 0.16)');
            ctx.fillStyle = g;
            ctx.fillRect(x0, 0, cellW, H);
            ctx.strokeStyle = 'rgba(110, 105, 140, 0.45)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x0, 0);
            ctx.lineTo(x0, H);
            ctx.stroke();
            if (i % 2 === 0) {
                ctx.strokeStyle = 'rgba(110, 105, 140, 0.12)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(x0, yLower(0.12));
                ctx.lineTo(x0 + cellW, yLower(0.55));
                ctx.moveTo(x0 + cellW * 2, yLower(0.12));
                ctx.lineTo(x0 + cellW, yLower(0.55));
                ctx.stroke();
            }
        }
        // Chordwise panel seams
        [0.18, 0.42, 0.7].forEach((c) => {
            ctx.strokeStyle = 'rgba(120, 115, 150, 0.22)';
            ctx.lineWidth = 2;
            [yUpper(c), yLower(c)].forEach((y) => {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(W, y);
                ctx.stroke();
            });
        });

        // Lilac leading edge band wrapping around the nose, widening toward the tips
        ctx.fillStyle = LILA;
        ctx.beginPath();
        const steps = 64;
        for (let i = 0; i <= steps; i++) {
            const s = -1 + (2 * i) / steps;
            const c = 0.085 + 0.05 * Math.pow(Math.abs(s), 3);
            const x = xOf(s);
            if (i === 0) ctx.moveTo(x, yUpper(c)); else ctx.lineTo(x, yUpper(c));
        }
        for (let i = steps; i >= 0; i--) {
            const s = -1 + (2 * i) / steps;
            ctx.lineTo(xOf(s), yLower(0.05 + 0.03 * Math.pow(Math.abs(s), 3)));
        }
        ctx.closePath();
        ctx.fill();
        // Thin white piping line inside the band (Phi detail)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
            const s = -1 + (2 * i) / steps;
            const y = yUpper(0.1 + 0.05 * Math.pow(Math.abs(s), 3));
            if (i === 0) ctx.moveTo(xOf(s), y); else ctx.lineTo(xOf(s), y);
        }
        ctx.stroke();

        // Cell intakes on the nose (dark openings just under the leading edge)
        for (let i = 0; i < cellCount; i++) {
            const s = -1 + ((i + 0.5) / cellCount) * 2;
            if (Math.abs(s) > 0.9) continue;
            ctx.fillStyle = 'rgba(40, 6, 34, 0.55)';
            ctx.beginPath();
            ctx.ellipse(xOf(s), yLower(0.012), cellW * 0.36, 9, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Trailing-edge bands (top and bottom)
        ctx.fillStyle = LILA;
        ctx.fillRect(0, 0, W, 14);
        ctx.fillRect(0, H - 14, W, 14);

        // Saw-tooth chevrons pointing forward from the trailing edge (upper surface) — 4 per side as on the Maestro
        [0.3, 0.45, 0.6, 0.75].forEach((sa) => {
            [-1, 1].forEach((side) => {
                const xc = xOf(side * sa);
                const halfW = cellW * 1.25;
                ctx.fillStyle = LILA_DARK;
                ctx.beginPath();
                ctx.moveTo(xc - halfW, yUpper(0.97));
                ctx.lineTo(xc + halfW, yUpper(0.97));
                ctx.lineTo(xc + side * halfW * 0.6, yUpper(0.8));
                ctx.closePath();
                ctx.fill();
            });
        });

        // Lilac wing tips (stabilo region) with a diagonal accent stripe
        [-1, 1].forEach((side) => {
            const xTip = side < 0 ? 0 : W;
            const xIn = xOf(side * 0.9);
            ctx.fillStyle = LILA;
            ctx.beginPath();
            ctx.moveTo(xTip, 0);
            ctx.lineTo(xIn + side * cellW * 0.6, 0);
            ctx.lineTo(xIn, MID);
            ctx.lineTo(xIn + side * cellW * 0.6, H);
            ctx.lineTo(xTip, H);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = LILA;
            ctx.lineWidth = 16;
            ctx.beginPath();
            ctx.moveTo(xOf(side * 0.82), yUpper(0.95));
            ctx.lineTo(xOf(side * 0.88), yUpper(0.3));
            ctx.moveTo(xOf(side * 0.82), yLower(0.95));
            ctx.lineTo(xOf(side * 0.88), yLower(0.3));
            ctx.stroke();
        });

        // Lower-surface branding (flipped vertically so it reads correctly when seen from beneath)
        ctx.save();
        ctx.fillStyle = LILA;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.translate(xOf(0.3), yLower(0.45));
        ctx.scale(1, -1);
        ctx.font = 'italic bold 150px Arial, sans-serif';
        ctx.fillText('phi', 0, 0);
        ctx.restore();
        ctx.save();
        ctx.fillStyle = LILA_DARK;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.translate(xOf(-0.32), yLower(0.45));
        ctx.scale(1, -1);
        ctx.font = 'bold 84px Arial, sans-serif';
        ctx.fillText('MAESTRO light 3', 0, 0);
        ctx.restore();

        const tex = new THREE.CanvasTexture(canvas);
        if (this.renderer && this.renderer.capabilities) {
            tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        }
        tex.needsUpdate = true;
        return tex;
    },

    /**
     * Writes the arched, billowed, brake-deformable paraglider canopy into `geo`'s position buffer.
     * Coordinates are in metres in the wing-pivot frame (origin = carabiner midpoint, -Z forward).
     * Returns per-call helpers so the line set can sample attachment points on the deformed canopy.
     */
    shapeParagliderCanopy(geo, w, brakeL = 0, brakeR = 0) {
        const pos = geo.attributes.position.array;
        const nS = w.nS;
        const nC = w.nC;
        const ring = 2 * nC + 1;
        const point = (s, c, upper, out) => {
            const as = Math.abs(s);
            const phi = s * w.arcAngle;
            const chord = w.chord0 * Math.sqrt(Math.max(0.0001, 1 - 0.86 * s * s));
            const zTe = w.zTe0 - 0.32 * s * s;
            const z = zTe - (1 - c) * chord;
            const tr = 0.155 - 0.05 * as;
            const tipClose = Math.pow(Math.max(0, 1 - Math.pow(as, 10)), 0.5);
            let half = 5 * tr * chord * (0.2969 * Math.sqrt(c) - 0.126 * c - 0.3516 * c * c + 0.2843 * c * c * c - 0.1036 * c * c * c * c) * tipClose;
            const cellPos = ((s + 1) / 2) * w.cells;
            const billow = Math.abs(Math.sin(Math.PI * cellPos));
            half *= upper ? 0.93 + 0.1 * billow : 0.9 + 0.08 * billow;
            let camber = 0.045 * chord * 4 * c * (1 - c) - 0.07 * chord * c;
            const brake = s < 0 ? brakeL : brakeR;
            const brakeSpan = Math.max(0, Math.min(1, (as - 0.15) / 0.75));
            if (c > 0.55) camber -= brake * brakeSpan * Math.pow((c - 0.55) / 0.45, 2) * 0.42 * chord;
            // Trailing edge scallops between line attachments
            if (c > 0.9) camber += 0.025 * (1 - billow) * ((c - 0.9) / 0.1) - 0.012;
            const r = w.arcR + camber + (upper ? half : -half);
            out[0] = r * Math.sin(phi);
            out[1] = w.topY + r * Math.cos(phi) - w.arcR;
            out[2] = z;
            return out;
        };
        const tmp = [0, 0, 0];
        for (let i = 0; i <= nS; i++) {
            const t = i / nS;
            const s = Math.sign(2 * t - 1) * (1 - Math.pow(1 - Math.abs(2 * t - 1), 1.15));
            for (let j = 0; j < ring; j++) {
                const upper = j > nC;
                const k = upper ? j - nC : nC - j;
                const c = (1 - Math.cos((Math.PI * k) / nC)) / 2;
                point(s, c, upper, tmp);
                const idx = (i * ring + j) * 3;
                pos[idx] = tmp[0];
                pos[idx + 1] = tmp[1];
                pos[idx + 2] = tmp[2];
            }
        }
        geo.attributes.position.needsUpdate = true;
        geo.computeVertexNormals();
        return point;
    },

    /**
     * Builds the paramotor avatar: a pilot in a paramotor harness with a caged two-stroke engine and carbon
     * propeller on his back, hanging under a high-resolution Phi Maestro Light 3 paraglider (white/lilac)
     * on a full cascaded line set. The propeller spins up with watts; brakes, pendulum swing and wing
     * surge are animated in updateParamotorDynamics.
     */
    buildParamotor() {
        const M = window.LoopKickerJourneyAvatarModels;
        this.dragonGroup = new THREE.Group();
        const SCALE = 0.85;
        // Pilot, motor and risers are drawn 1.35x larger than true scale relative to the sail so they read well on screen
        const PS = 1.35;
        const rigRoot = new THREE.Group();
        rigRoot.scale.set(SCALE, SCALE, SCALE);
        rigRoot.position.y = -0.6;
        this.dragonGroup.add(rigRoot);

        const pilotGroup = new THREE.Group();
        const wingPivot = new THREE.Group();
        pilotGroup.scale.set(PS, PS, PS);
        rigRoot.add(pilotGroup);
        rigRoot.add(wingPivot);

        // ---------- Canopy ----------
        const w = {
            nS: 220,
            nC: 30,
            cells: 52,
            arcR: 6.3,
            arcAngle: 5.55 / 6.3,
            chord0: 2.5,
            zTe0: 1.55,
            topY: 7.0
        };
        const ring = 2 * w.nC + 1;
        const vCount = (w.nS + 1) * ring;
        const canopyGeo = new THREE.BufferGeometry();
        canopyGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vCount * 3), 3));
        const uvs = new Float32Array(vCount * 2);
        for (let i = 0; i <= w.nS; i++) {
            const t = i / w.nS;
            const s = Math.sign(2 * t - 1) * (1 - Math.pow(1 - Math.abs(2 * t - 1), 1.15));
            for (let j = 0; j < ring; j++) {
                const upper = j > w.nC;
                const k = upper ? j - w.nC : w.nC - j;
                const c = (1 - Math.cos((Math.PI * k) / w.nC)) / 2;
                uvs[(i * ring + j) * 2] = (s + 1) / 2;
                // v = 1 upper TE, 0.5 LE, 0 lower TE (CanvasTexture flipY maps v = 1 to the canvas top)
                uvs[(i * ring + j) * 2 + 1] = upper ? 0.5 + c * 0.5 : 0.5 - c * 0.5;
            }
        }
        canopyGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        const indices = [];
        for (let i = 0; i < w.nS; i++) {
            for (let j = 0; j < ring - 1; j++) {
                const a = i * ring + j;
                const b = (i + 1) * ring + j;
                indices.push(a, b, a + 1, b, b + 1, a + 1);
            }
        }
        canopyGeo.setIndex(indices);
        const point = M.shapeParagliderCanopy(canopyGeo, w, 0, 0);
        const wingTex = M.createPhiMaestroWingTexture.call(this, w.cells);
        const canopyMat = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            map: wingTex,
            emissive: 0x8a8892,
            emissiveMap: wingTex,
            specular: 0x5a5560,
            shininess: 38,
            side: THREE.DoubleSide
        });
        const canopy = new THREE.Mesh(canopyGeo, canopyMat);
        wingPivot.add(canopy);

        // ---------- Line set (A/B/C + brakes), cascaded: canopy -> gallery knots -> main lines -> risers ----------
        const riserTop = {
            A: (side) => new THREE.Vector3(side * 0.25, 0.5, -0.06).multiplyScalar(PS),
            B: (side) => new THREE.Vector3(side * 0.26, 0.52, 0.0).multiplyScalar(PS),
            C: (side) => new THREE.Vector3(side * 0.27, 0.53, 0.07).multiplyScalar(PS),
            K: (side) => new THREE.Vector3(side * 0.28, 0.55, 0.12).multiplyScalar(PS)
        };
        const rows = [
            { key: 'A', c: 0.1, color: 0xe11d48 },
            { key: 'B', c: 0.34, color: 0xf59e0b },
            { key: 'C', c: 0.64, color: 0xfacc15 },
            { key: 'K', c: 1.0, color: 0xf97316 }
        ];
        const attachS = [];
        for (let k = 0; k < 15; k++) attachS.push(0.04 + (k / 14) * 0.9);
        const lineSets = rows.map((row) => {
            const n = attachS.length * 2 * 2 + 10 * 2;
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3));
            const mat = new THREE.LineBasicMaterial({ color: row.color, transparent: true, opacity: 0.7 });
            const seg = new THREE.LineSegments(g, mat);
            seg.frustumCulled = false;
            wingPivot.add(seg);
            return { row, geo: g };
        });
        const galleryMat = new THREE.LineBasicMaterial({ color: 0xf1f5f9, transparent: true, opacity: 0.75 });
        const galleryGeo = new THREE.BufferGeometry();
        galleryGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rows.length * attachS.length * 2 * 2 * 3), 3));
        const gallery = new THREE.LineSegments(galleryGeo, galleryMat);
        gallery.frustumCulled = false;
        wingPivot.add(gallery);

        const tmpP = [0, 0, 0];
        const updateLines = (pointFn, toggles) => {
            const gArr = galleryGeo.attributes.position.array;
            let gi = 0;
            lineSets.forEach(({ row, geo }) => {
                const arr = geo.attributes.position.array;
                let li = 0;
                const push = (a, b) => {
                    arr[li++] = a.x; arr[li++] = a.y; arr[li++] = a.z;
                    arr[li++] = b.x; arr[li++] = b.y; arr[li++] = b.z;
                };
                [-1, 1].forEach((side) => {
                    const top = row.key === 'K' ? toggles[side < 0 ? 0 : 1] : riserTop[row.key](side);
                    // groups of three attachments share a gallery knot, knots share a main line
                    for (let g0 = 0; g0 < attachS.length; g0 += 3) {
                        const knot = new THREE.Vector3();
                        const pts = [];
                        for (let k = g0; k < Math.min(attachS.length, g0 + 3); k++) {
                            const s = side * attachS[k];
                            const c = row.key === 'K' ? 0.995 : row.c;
                            pointFn(s, c, false, tmpP);
                            const p = new THREE.Vector3(tmpP[0], tmpP[1], tmpP[2]);
                            pts.push(p);
                            knot.add(p);
                        }
                        knot.multiplyScalar(1 / pts.length);
                        knot.lerp(top, 0.3);
                        pts.forEach((p) => {
                            gArr[gi++] = p.x; gArr[gi++] = p.y; gArr[gi++] = p.z;
                            gArr[gi++] = knot.x; gArr[gi++] = knot.y; gArr[gi++] = knot.z;
                        });
                        push(knot, top);
                    }
                });
                geo.attributes.position.needsUpdate = true;
                geo.setDrawRange(0, li / 3);
            });
            galleryGeo.setDrawRange(0, gi / 3);
            galleryGeo.attributes.position.needsUpdate = true;
        };

        // Risers (webbing), maillons and brake toggles live in the wing frame
        const webbingMat = new THREE.MeshPhongMaterial({ color: 0x1f1f24, specular: 0x444444, shininess: 30 });
        const lilaWebMat = new THREE.MeshPhongMaterial({ color: 0xb4128c, specular: 0x553355, shininess: 40 });
        const steelMat = new THREE.MeshPhongMaterial({ color: 0xd1d5db, specular: 0xffffff, shininess: 160 });
        const placeBetween = (mesh, a, b) => {
            const dir = new THREE.Vector3().subVectors(b, a);
            const len = dir.length();
            mesh.position.copy(a).addScaledVector(dir, 0.5);
            mesh.scale.set(1, Math.max(0.0001, len), 1);
            mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
        };
        const unitCyl = (r, mat, seg = 10) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, seg), mat);
        [-1, 1].forEach((side) => {
            const carabiner = new THREE.Vector3(side * 0.22, 0, 0.03).multiplyScalar(PS);
            Object.keys(riserTop).forEach((key, idx) => {
                const strap = new THREE.Mesh(new THREE.BoxGeometry(0.025, 1, 0.006), key === 'A' ? lilaWebMat : webbingMat);
                placeBetween(strap, carabiner, riserTop[key](side));
                wingPivot.add(strap);
                const maillon = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.004, 6, 12), steelMat);
                maillon.position.copy(riserTop[key](side));
                maillon.rotation.y = Math.PI / 2;
                wingPivot.add(maillon);
                if (idx === 0) {
                    const pulley = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.006, 6, 14), steelMat);
                    pulley.position.copy(riserTop.C(side)).add(new THREE.Vector3(0, -0.04, 0.02));
                    pulley.rotation.y = Math.PI / 2;
                    wingPivot.add(pulley);
                }
            });
            const krabMesh = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 8, 18), steelMat);
            krabMesh.scale.set(PS, 1.5 * PS, PS);
            krabMesh.position.copy(carabiner);
            krabMesh.rotation.y = Math.PI / 2;
            wingPivot.add(krabMesh);
        });
        const toggleMat = new THREE.MeshPhongMaterial({ color: 0x111827, specular: 0x666666, shininess: 50 });
        const toggleMeshes = [-1, 1].map((side) => {
            const t = new THREE.Group();
            t.scale.set(PS, PS, PS);
            const grip = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 8, 18), toggleMat);
            grip.scale.set(1, 1.4, 1);
            grip.rotation.y = Math.PI / 2;
            t.add(grip);
            const tab = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.02), lilaWebMat);
            tab.position.y = 0.07;
            t.add(tab);
            wingPivot.add(t);
            return t;
        });

        // ---------- Pilot (origin = carabiner midpoint, metres) ----------
        const suitMat = new THREE.MeshPhongMaterial({ color: 0x2b2f3a, specular: 0x3b3f4a, shininess: 25 });
        const suitAccentMat = new THREE.MeshPhongMaterial({ color: 0x6b2b8f, specular: 0x9b6bb0, shininess: 35 });
        const pantsMat = new THREE.MeshPhongMaterial({ color: 0x15171c, specular: 0x2a2a2a, shininess: 18 });
        const skinMat = new THREE.MeshPhongMaterial({ color: 0xe0ac8a, specular: 0x332211, shininess: 18 });
        const gloveMat = new THREE.MeshPhongMaterial({ color: 0x0b0b0e, specular: 0x333333, shininess: 30 });
        const helmetMat = new THREE.MeshPhongMaterial({ color: 0xf8fafc, specular: 0xffffff, shininess: 140 });
        const visorMat = new THREE.MeshPhongMaterial({ color: 0x0f172a, specular: 0x93c5fd, shininess: 200, transparent: true, opacity: 0.88 });
        const harnessMat = new THREE.MeshPhongMaterial({ color: 0x18181b, specular: 0x3f3f46, shininess: 40 });
        const limeMat = new THREE.MeshPhongMaterial({ color: 0xa3e635, emissive: 0x1a2e05, shininess: 60 });
        const cyanMat = new THREE.MeshPhongMaterial({ color: 0x22d3ee, emissive: 0x05303a, shininess: 60 });
        const bootMat = new THREE.MeshPhongMaterial({ color: 0x3f2a1d, specular: 0x222222, shininess: 25 });

        const hip = new THREE.Vector3(0, -0.55, 0.06);
        // Torso, slightly reclined
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.56, 18), suitMat);
        torso.scale.set(1.15, 1, 0.8);
        torso.position.set(0, -0.27, 0.1);
        torso.rotation.x = -0.18;
        pilotGroup.add(torso);
        const chestStripe = new THREE.Mesh(new THREE.CylinderGeometry(0.172, 0.168, 0.06, 18), suitAccentMat);
        chestStripe.scale.set(1.15, 1, 0.8);
        chestStripe.position.set(0, -0.12, 0.075);
        chestStripe.rotation.x = -0.18;
        pilotGroup.add(chestStripe);
        const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 12), suitMat);
        shoulders.scale.set(1.15, 0.45, 0.75);
        shoulders.position.set(0, -0.04, 0.13);
        pilotGroup.add(shoulders);
        const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), pantsMat);
        pelvis.scale.set(1.05, 0.7, 0.95);
        pelvis.position.copy(hip);
        pilotGroup.add(pelvis);

        // Head + helmet + visor + chin bar
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 0.12, 0.12);
        pilotGroup.add(headGroup);
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.1, 12), skinMat);
        neck.position.set(0, -0.06, 0);
        headGroup.add(neck);
        const face = new THREE.Mesh(new THREE.SphereGeometry(0.095, 18, 14), skinMat);
        face.scale.set(0.95, 1.1, 1.0);
        face.position.set(0, 0.06, -0.02);
        headGroup.add(face);
        const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.135, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.62), helmetMat);
        helmet.position.set(0, 0.08, 0.01);
        headGroup.add(helmet);
        const helmetStripe = new THREE.Mesh(new THREE.TorusGeometry(0.128, 0.012, 8, 32, Math.PI), suitAccentMat);
        helmetStripe.rotation.y = Math.PI / 2;
        helmetStripe.position.set(0, 0.08, 0.01);
        headGroup.add(helmetStripe);
        const visor = new THREE.Mesh(new THREE.SphereGeometry(0.128, 24, 12, Math.PI * 1.15, Math.PI * 0.7, Math.PI * 0.32, Math.PI * 0.26), visorMat);
        visor.position.set(0, 0.06, 0.0);
        headGroup.add(visor);
        [-1, 1].forEach((side) => {
            const earCup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 16), harnessMat);
            earCup.rotation.z = Math.PI / 2;
            earCup.position.set(side * 0.125, 0.05, 0.01);
            headGroup.add(earCup);
        });
        const mic = unitCyl(0.006, harnessMat, 6);
        placeBetween(mic, new THREE.Vector3(-0.13, 0.03, 0.0), new THREE.Vector3(-0.04, -0.02, -0.11));
        headGroup.add(mic);

        // Legs: thighs forward on the seat board, shins angled down, boots
        const legParts = [];
        [-1, 1].forEach((side) => {
            const h = new THREE.Vector3(side * 0.1, -0.6, 0.0);
            const knee = new THREE.Vector3(side * 0.13, -0.66, -0.42);
            const ankle = new THREE.Vector3(side * 0.12, -1.06, -0.52);
            const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.07, 1, 14), pantsMat);
            placeBetween(thigh, h, knee);
            pilotGroup.add(thigh);
            const kneeBall = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), pantsMat);
            kneeBall.position.copy(knee);
            pilotGroup.add(kneeBall);
            const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.05, 1, 14), pantsMat);
            placeBetween(shin, knee, ankle);
            pilotGroup.add(shin);
            const boot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.27), bootMat);
            boot.position.copy(ankle).add(new THREE.Vector3(0, -0.03, -0.06));
            boot.rotation.x = 0.5;
            pilotGroup.add(boot);
            legParts.push({ thigh, shin, boot });
        });

        // Harness: seat board, back protector, shoulder straps, chest strap, side stripes (lime/cyan)
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.48), harnessMat);
        seat.position.set(0, -0.7, -0.12);
        seat.rotation.x = 0.06;
        pilotGroup.add(seat);
        const backPad = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.78, 0.12), harnessMat);
        backPad.position.set(0, -0.32, 0.27);
        backPad.rotation.x = -0.15;
        pilotGroup.add(backPad);
        [-1, 1].forEach((side) => {
            const sidePod = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.5), harnessMat);
            sidePod.position.set(side * 0.25, -0.6, 0.02);
            pilotGroup.add(sidePod);
            const lime = new THREE.Mesh(new THREE.BoxGeometry(0.084, 0.03, 0.42), limeMat);
            lime.position.set(side * 0.25, -0.56, 0.0);
            pilotGroup.add(lime);
            const cyan = new THREE.Mesh(new THREE.BoxGeometry(0.084, 0.022, 0.3), cyanMat);
            cyan.position.set(side * 0.25, -0.61, -0.04);
            pilotGroup.add(cyan);
            const strap = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.58, 0.02), harnessMat);
            strap.position.set(side * 0.11, -0.25, -0.02);
            strap.rotation.x = -0.18;
            pilotGroup.add(strap);
            const hangStrap = unitCyl(0.014, harnessMat, 6);
            placeBetween(hangStrap, new THREE.Vector3(side * 0.22, 0, 0.03), new THREE.Vector3(side * 0.24, -0.5, 0.05));
            pilotGroup.add(hangStrap);
        });
        const chestStrap = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.035, 0.02), harnessMat);
        chestStrap.position.set(0, -0.22, -0.045);
        pilotGroup.add(chestStrap);

        // Arms (2-bone IK each frame toward the brake toggles)
        const arms = [-1, 1].map((side) => {
            const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.05, 1, 12), suitMat);
            const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.04, 1, 12), suitMat);
            const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), suitMat);
            const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), gloveMat);
            hand.scale.set(0.9, 1.2, 0.9);
            [upper, fore, elbow, hand].forEach((m) => pilotGroup.add(m));
            return { side, shoulder: new THREE.Vector3(side * 0.2, -0.06, 0.12), upper, fore, elbow, hand, lenU: 0.3, lenF: 0.3 };
        });
        // Throttle in the right hand with a cable to the engine
        const throttle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.13, 10), new THREE.MeshPhongMaterial({ color: 0xdc2626, shininess: 80 }));
        pilotGroup.add(throttle);
        const throttleCableGeo = new THREE.BufferGeometry();
        throttleCableGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
        const throttleCable = new THREE.Line(throttleCableGeo, new THREE.LineBasicMaterial({ color: 0x111111 }));
        throttleCable.frustumCulled = false;
        pilotGroup.add(throttleCable);

        // ---------- Paramotor unit on the back ----------
        const motor = new THREE.Group();
        motor.position.set(0, -0.32, 0.36);
        pilotGroup.add(motor);
        const aluMat = new THREE.MeshPhongMaterial({ color: 0xc7ccd4, specular: 0xffffff, shininess: 120 });
        const carbonMat = new THREE.MeshPhongMaterial({ color: 0x1b1b1f, specular: 0x9ca3af, shininess: 110 });
        const engineMat = new THREE.MeshPhongMaterial({ color: 0x3f3f46, specular: 0xa1a1aa, shininess: 80 });
        const finMat = new THREE.MeshPhongMaterial({ color: 0x9ca3af, specular: 0xffffff, shininess: 100 });
        const tankMat = new THREE.MeshPhongMaterial({ color: 0xf5f5f4, specular: 0xffffff, shininess: 60, transparent: true, opacity: 0.82 });
        const fuelMat = new THREE.MeshPhongMaterial({ color: 0xf59e0b, emissive: 0x3a1d02, transparent: true, opacity: 0.85 });

        // Cage: outer hoop, inner hoop, spokes and safety netting
        const CAGE_R = 0.72;
        const cageCenter = new THREE.Vector3(0, 0.12, 0.42);
        [CAGE_R, CAGE_R - 0.05].forEach((r, i) => {
            const hoop = new THREE.Mesh(new THREE.TorusGeometry(r, i === 0 ? 0.016 : 0.009, 10, 96), aluMat);
            hoop.position.copy(cageCenter).add(new THREE.Vector3(0, 0, i * 0.05));
            motor.add(hoop);
        });
        for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            const spoke = unitCyl(0.008, aluMat, 6);
            placeBetween(spoke,
                new THREE.Vector3(Math.cos(a) * CAGE_R, Math.sin(a) * CAGE_R, 0).add(cageCenter),
                new THREE.Vector3(Math.cos(a) * 0.2, Math.sin(a) * 0.2 + 0.0, -0.14).add(cageCenter));
            motor.add(spoke);
        }
        const netPts = [];
        const NET_Z = cageCenter.z + 0.08;
        for (let i = 0; i < 36; i++) {
            const a = (i / 36) * Math.PI * 2;
            netPts.push(Math.cos(a) * 0.08, cageCenter.y + Math.sin(a) * 0.08, NET_Z, Math.cos(a) * CAGE_R, cageCenter.y + Math.sin(a) * CAGE_R, NET_Z);
        }
        [0.2, 0.34, 0.48, 0.6].forEach((r) => {
            for (let i = 0; i < 48; i++) {
                const a0 = (i / 48) * Math.PI * 2;
                const a1 = ((i + 1) / 48) * Math.PI * 2;
                netPts.push(Math.cos(a0) * r, cageCenter.y + Math.sin(a0) * r, NET_Z, Math.cos(a1) * r, cageCenter.y + Math.sin(a1) * r, NET_Z);
            }
        });
        const netGeo = new THREE.BufferGeometry();
        netGeo.setAttribute('position', new THREE.Float32BufferAttribute(netPts, 3));
        motor.add(new THREE.LineSegments(netGeo, new THREE.LineBasicMaterial({ color: 0x27272a, transparent: true, opacity: 0.7 })));

        // Main frame: J-bars to the harness, base plate and lower bars
        [-1, 1].forEach((side) => {
            const jBar = unitCyl(0.014, aluMat, 8);
            placeBetween(jBar, new THREE.Vector3(side * 0.24, -0.38, -0.05), new THREE.Vector3(side * 0.42, -0.45, 0.4));
            motor.add(jBar);
            const upright = unitCyl(0.012, aluMat, 8);
            placeBetween(upright, new THREE.Vector3(side * 0.42, -0.45, 0.4), new THREE.Vector3(side * 0.5, 0.45, 0.42));
            motor.add(upright);
            const swingArm = unitCyl(0.013, aluMat, 8);
            placeBetween(swingArm, new THREE.Vector3(side * 0.24, 0.3, 0.02), new THREE.Vector3(side * 0.2, -0.38, -0.05));
            motor.add(swingArm);
        });
        const basePlate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.3), carbonMat);
        basePlate.position.set(0, -0.36, 0.2);
        motor.add(basePlate);

        // Engine: crankcase, finned cylinder, carburettor + airbox, reduction pulley and belt
        const crank = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.16), engineMat);
        crank.position.set(0, -0.12, 0.18);
        motor.add(crank);
        const cylGroup = new THREE.Group();
        cylGroup.position.set(0, -0.12, 0.08);
        cylGroup.rotation.x = Math.PI / 2;
        motor.add(cylGroup);
        for (let i = 0; i < 9; i++) {
            const fin = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.008, 24), finMat);
            fin.position.y = 0.02 + i * 0.016;
            cylGroup.add(fin);
        }
        const cylBody = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 20), engineMat);
        cylBody.position.y = 0.08;
        cylGroup.add(cylBody);
        const sparkCap = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.05, 10), new THREE.MeshPhongMaterial({ color: 0x111111 }));
        sparkCap.position.y = 0.19;
        cylGroup.add(sparkCap);
        const airbox = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 20), new THREE.MeshPhongMaterial({ color: 0xb4128c, specular: 0xffffff, shininess: 70 }));
        airbox.rotation.z = Math.PI / 2;
        airbox.position.set(-0.18, -0.08, 0.16);
        motor.add(airbox);
        const bigPulley = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.03, 32), aluMat);
        bigPulley.rotation.x = Math.PI / 2;
        bigPulley.position.set(0, cageCenter.y, 0.3);
        motor.add(bigPulley);
        const smallPulley = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 20), aluMat);
        smallPulley.rotation.x = Math.PI / 2;
        smallPulley.position.set(0, -0.12, 0.3);
        motor.add(smallPulley);
        [-1, 1].forEach((side) => {
            const belt = new THREE.Mesh(new THREE.BoxGeometry(0.012, 1, 0.024), carbonMat);
            placeBetween(belt, new THREE.Vector3(side * 0.05, -0.12, 0.3), new THREE.Vector3(side * 0.15, cageCenter.y, 0.3));
            motor.add(belt);
        });
        const reductionArm = unitCyl(0.02, aluMat, 8);
        placeBetween(reductionArm, new THREE.Vector3(0, -0.1, 0.26), new THREE.Vector3(0, cageCenter.y, 0.26));
        motor.add(reductionArm);

        // Exhaust: tuned pipe curling under the engine to a silencer
        const exhaustCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0.0, -0.16, 0.0),
            new THREE.Vector3(0.12, -0.28, -0.02),
            new THREE.Vector3(0.26, -0.3, 0.1),
            new THREE.Vector3(0.3, -0.22, 0.26)
        ]);
        motor.add(new THREE.Mesh(new THREE.TubeGeometry(exhaustCurve, 24, 0.028, 10, false), aluMat));
        const silencer = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.22, 16), aluMat);
        silencer.position.set(0.3, -0.12, 0.3);
        motor.add(silencer);

        // Fuel tank under the seat (translucent with fuel level)
        const tank = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.24), tankMat);
        tank.position.set(0, -0.5, 0.16);
        motor.add(tank);
        const fuel = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.09, 0.22), fuelMat);
        fuel.position.set(0, -0.53, 0.16);
        motor.add(fuel);
        const fuelCap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 12), new THREE.MeshPhongMaterial({ color: 0xdc2626 }));
        fuelCap.position.set(0.12, -0.41, 0.16);
        motor.add(fuelCap);

        // Propeller: two twisted carbon blades with lilac tips, hub + spinner, translucent motion-blur disc
        const propGroup = new THREE.Group();
        propGroup.position.set(0, cageCenter.y, cageCenter.z - 0.04);
        motor.add(propGroup);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.07, 20), carbonMat);
        hub.rotation.x = Math.PI / 2;
        propGroup.add(hub);
        const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.1, 20), aluMat);
        spinner.rotation.x = Math.PI / 2;
        spinner.position.z = 0.08;
        propGroup.add(spinner);
        const propTipMat = new THREE.MeshPhongMaterial({ color: 0xb4128c, specular: 0xffffff, shininess: 90 });
        const PROP_R = 0.63;
        const bladeShape = new THREE.Shape();
        bladeShape.moveTo(0.05, -0.03);
        bladeShape.bezierCurveTo(0.25, -0.06, 0.45, -0.05, PROP_R - 0.02, -0.022);
        bladeShape.quadraticCurveTo(PROP_R + 0.005, 0, PROP_R - 0.02, 0.02);
        bladeShape.bezierCurveTo(0.45, 0.035, 0.25, 0.045, 0.05, 0.03);
        bladeShape.closePath();
        const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 24 });
        // Twist: higher pitch near the root
        const bp = bladeGeo.attributes.position;
        for (let i = 0; i < bp.count; i++) {
            const x = bp.getX(i);
            const twist = 0.55 - 0.4 * (x / PROP_R);
            const y = bp.getY(i);
            const z = bp.getZ(i) - 0.006;
            bp.setY(i, y * Math.cos(twist) - z * Math.sin(twist));
            bp.setZ(i, y * Math.sin(twist) + z * Math.cos(twist));
        }
        bladeGeo.computeVertexNormals();
        [0, Math.PI].forEach((rot) => {
            const blade = new THREE.Mesh(bladeGeo, carbonMat);
            blade.rotation.z = rot;
            propGroup.add(blade);
            const tip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.016), propTipMat);
            tip.position.set(Math.cos(rot) * (PROP_R - 0.05), Math.sin(rot) * (PROP_R - 0.05), 0);
            tip.rotation.z = rot;
            propGroup.add(tip);
        });
        const blurMat = new THREE.MeshBasicMaterial({ color: 0x52525b, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false });
        const blurDisc = new THREE.Mesh(new THREE.RingGeometry(0.07, PROP_R, 64, 1), blurMat);
        blurDisc.position.set(0, cageCenter.y, cageCenter.z - 0.04);
        motor.add(blurDisc);

        rigRoot.rotation.order = 'YXZ';
        pilotGroup.rotation.order = 'YXZ';
        wingPivot.rotation.order = 'YXZ';
        this.avatarAnimParts = { propGroup };
        this.paramotorRig = M.createAvatarFlightState({
            rigRoot,
            pilotGroup,
            wingPivot,
            headGroup,
            canopyGeo,
            wingSpec: w,
            pilotScale: PS,
            point,
            updateLines,
            toggleMeshes,
            arms,
            throttle,
            throttleCableGeo,
            propGroup,
            blurMat,
            propAngle: 0,
            propSpeed: 0,
            brakeL: 0.12,
            brakeR: 0.12,
            shapedBrakeL: -1,
            shapedBrakeR: -1,
            effortSlow: 0
        });
        M.updateParamotorDynamics.call(this, 0.016, {});

        this.dragonGroup.position.set(0, this.dragonCurrentY, 0);
        this.scene.add(this.dragonGroup);
    },

    /**
     * Paramotor dynamics: propeller spins up with watts (with motion-blur disc), pilot pendulum swings forward
     * under thrust surges and lags the wing on roll-in, the wing banks/surges on a soft spring, brakes are
     * pulled on the inside of turns (deforming the trailing edge and lines), the hands follow the toggles
     * via 2-bone IK and the head looks into the turn.
     */
    updateParamotorDynamics(dt, ctx = {}) {
        const rig = this.paramotorRig;
        if (!rig) return;
        const M = window.LoopKickerJourneyAvatarModels;
        const f = M.trackAvatarFlightState(rig, dt, ctx);
        const { step, clamp, smooth } = f;
        rig.effortSlow = smooth(rig.effortSlow, rig.effort, 0.7);

        // Propeller: idle when coasting, revs up with watts
        const targetSpeed = f.isPedaling ? 14 + 30 * clamp(f.wattRatio, 0, 1.8) : 6;
        rig.propSpeed = smooth(rig.propSpeed, targetSpeed, 2.5);
        rig.propAngle = (rig.propAngle + rig.propSpeed * step) % (Math.PI * 2);
        rig.propGroup.rotation.z = rig.propAngle;
        rig.blurMat.opacity = clamp((rig.propSpeed - 8) / 80, 0, 0.2);

        // Pendulum: pilot swings forward on throttle surges and outward/lagging when rolling in
        const surge = rig.effort - rig.effortSlow;
        const swingX = f.spring('swingX', clamp(0.06 + 0.35 * surge + 0.05 * rig.effort - 0.05 * rig.pitchRate, -0.25, 0.35), 2.6, 0.22);
        const swingZ = f.spring('swingZ', clamp(0.22 * rig.rollRate + 0.05 * f.yawN, -0.3, 0.3), 2.8, 0.2);
        rig.pilotGroup.rotation.x = swingX;
        rig.pilotGroup.rotation.z = swingZ * 0.6;
        // Wing: surges back slightly under power, banks ahead of the pilot, light turbulence breathing
        const turb = 0.012 * Math.sin(rig.time * 0.9) + 0.008 * Math.sin(rig.time * 2.3 + 1.3);
        rig.wingPivot.rotation.x = f.spring('wingPitch', clamp(-0.12 * surge + 0.04 * f.climb, -0.15, 0.15), 3.2, 0.3) + turb;
        rig.wingPivot.rotation.z = f.spring('wingRoll', clamp(-0.12 * rig.rollRate, -0.2, 0.2), 3.5, 0.35) + turb * 0.6;
        rig.wingPivot.rotation.y = f.spring('wingYaw', clamp(-0.06 * f.yawN, -0.1, 0.1), 3, 0.5);
        rig.rigRoot.position.y = -0.6 + 0.06 * Math.sin(rig.time * 0.8);

        // Brakes: inside brake on turns, light symmetric trim brake, a touch more when climbing
        const base = 0.1 + 0.08 * Math.max(0, f.climb);
        const turn = clamp(f.bank * 0.9 + f.yawN * 0.25, -1, 1);
        rig.brakeL = smooth(rig.brakeL, clamp(base + Math.max(0, -turn) * 0.75, 0, 1), 4);
        rig.brakeR = smooth(rig.brakeR, clamp(base + Math.max(0, turn) * 0.75, 0, 1), 4);
        if (Math.abs(rig.brakeL - rig.shapedBrakeL) > 0.004 || Math.abs(rig.brakeR - rig.shapedBrakeR) > 0.004) {
            rig.point = M.shapeParagliderCanopy(rig.canopyGeo, rig.wingSpec, rig.brakeL, rig.brakeR);
            rig.shapedBrakeL = rig.brakeL;
            rig.shapedBrakeR = rig.brakeR;
        }
        const toggles = [-1, 1].map((side) => {
            const b = side < 0 ? rig.brakeL : rig.brakeR;
            return new THREE.Vector3(side * (0.29 - 0.04 * b), 0.42 - 0.62 * b, 0.12 - 0.12 * b).multiplyScalar(rig.pilotScale);
        });
        rig.toggleMeshes.forEach((t, i) => t.position.copy(toggles[i]));
        rig.updateLines(rig.point, toggles);

        // Arms: 2-bone IK from shoulders to toggles (expressed in the pilot frame)
        rig.rigRoot.updateMatrixWorld(true);
        const up = new THREE.Vector3(0, 1, 0);
        const placeLimb = (mesh, a, b) => {
            const dir = new THREE.Vector3().subVectors(b, a);
            mesh.position.copy(a).addScaledVector(dir, 0.5);
            mesh.scale.set(1, dir.length(), 1);
            mesh.quaternion.setFromUnitVectors(up, dir.normalize());
        };
        rig.arms.forEach((arm, i) => {
            const target = rig.wingPivot.localToWorld(toggles[i].clone().add(new THREE.Vector3(0, -0.03, 0)));
            rig.pilotGroup.worldToLocal(target);
            const S = arm.shoulder;
            const toT = new THREE.Vector3().subVectors(target, S);
            const d = clamp(toT.length(), 0.05, arm.lenU + arm.lenF - 0.001);
            toT.normalize();
            const hand = S.clone().addScaledVector(toT, d);
            const a = (arm.lenU * arm.lenU - arm.lenF * arm.lenF + d * d) / (2 * d);
            const h = Math.sqrt(Math.max(0, arm.lenU * arm.lenU - a * a));
            const pole = new THREE.Vector3(arm.side, -0.3, 0.6);
            pole.addScaledVector(toT, -pole.dot(toT)).normalize();
            const elbow = S.clone().addScaledVector(toT, a).addScaledVector(pole, h);
            placeLimb(arm.upper, S, elbow);
            placeLimb(arm.fore, elbow, hand);
            arm.elbow.position.copy(elbow);
            arm.hand.position.copy(hand);
            if (arm.side > 0) {
                rig.throttle.position.copy(hand).add(new THREE.Vector3(0.0, -0.06, -0.02));
                const cable = rig.throttleCableGeo.attributes.position.array;
                cable[0] = rig.throttle.position.x; cable[1] = rig.throttle.position.y - 0.06; cable[2] = rig.throttle.position.z;
                cable[3] = 0.28; cable[4] = -0.55; cable[5] = 0.3;
                rig.throttleCableGeo.attributes.position.needsUpdate = true;
            }
        });

        // Head: looks into the turn and up at the wing a little when braking hard
        rig.headGroup.rotation.y = smooth(rig.headGroup.rotation.y, -0.5 * turn, 3);
        rig.headGroup.rotation.x = smooth(rig.headGroup.rotation.x, 0.15 * Math.max(rig.brakeL, rig.brakeR) - 0.05 * f.climb, 3);
        rig.headGroup.rotation.z = -swingZ * 0.5;
    }
};
