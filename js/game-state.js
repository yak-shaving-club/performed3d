        // =========================================================================
        // 6. MAIN GAME STATE & SCORING LOGIC
        // =========================================================================
        const soundEngine = new ArcadeSoundEngine();
        const musicEngine = new AdaptiveMusicEngine(soundEngine);
        const fxEngine = new VisualEffectsEngine(document.getElementById('fxCanvas'));

        const CAMERA_VIEWS = {
            1: 'Chase',
            2: 'Far Chase',
            3: 'Top-Down',
            4: 'Front',
            5: 'Front Far'
        };

        const FTP_TEST_STOP_THRESHOLD_SECONDS = 5;

        const state = {
            currentScreen: 'splash',
            selectedPresetKey: 'kickr_arcade',
            durationFilter: 'all',
            intensityFilter: 'all',
            avatarType: 'aero_wyvern',
            cameraView: 1,
            ftp: 200,
            accuracyToleranceWatts: 40,
            donutVisualSizeBoost: 1.0,
            resistanceMode: 'easy',
            currentGradientPct: 0.0,
            targetGradientPct: 0.0,
            gradientProfile: [],
            renderObstacles: false,
            simMode: true,
            simAutoJitter: false,
            workout: null,
            isRunning: false,
            hasStartedSession: false,
            forceShowSetupDuringTraining: false,
            elapsedSec: 0,
            startTimeMs: null,
            ftpTestPedalingStarted: false,
            ftpTestZeroPedalSeconds: 0,
            ftpTestAutoStopped: false,
            lastKickrPedalTimestampMs: 0,

            // Live telemetry
            rawKickrWatts: 0,
            kickrWattSamples: [],
            actualWatts: 0,
            heartRate: null,
            cadence: 0,
            speedKmh: 0,
            totalDistanceMeters: 0,

            // Scoring, streaks & 3D counters
            totalScore: 0,
            lastPointsAwarded: 0,
            streakSeconds: 0,
            maxStreakSeconds: 0,
            comboMultiplier: 1.0,
            inZoneSeconds: 0,
            gatesPassedCount: 0,
            obstaclesDestroyedCount: 0,
            obstacleHitsCount: 0,
            arrowHitsCount: 0,

            // Dragon left/right flight-simulator heading & 3D position inside the canyon (bounded so dragon stays in canyon and on screen)
            steeringEnabled: true,
            steerLeftPressed: false,
            steerRightPressed: false,
            bleSteerInput: 0.0,
            bleSteerAngleDeg: 0.0,
            phoneSteerInput: 0.0,
            phoneSteerAngleDeg: 0.0,
            dragonSteerOffsetX: 0.0,
            dragonHeadingAngle: 0.0,
            dragonWorldX: 0.0,

            samples: [],
            lastSummary: null,
            preparedScreenshotDataUrl: null,
            preparedScreenshotTimestamp: null,
            workoutXml: null,
            ghost: null
        };

        function generateTerrainGradientProfile(totalDurationSec, mode) {
            const total = Math.max(1, Math.ceil(totalDurationSec));
            const profile = [];
            let current = 0.0;
            let target = 0.0;
            let elevationMeters = 0.0;
            let ticksRemaining = 0;

            for (let s = 0; s <= total; s++) {
                if (mode === 'easy' || mode === 'erg') {
                    current = 0.0;
                    target = 0.0;
                    ticksRemaining = 0;
                } else if (mode === 'medium' || mode === 'realistic') {
                    if (ticksRemaining <= 0) {
                        ticksRemaining = 20 + Math.floor(Math.random() * 18);
                        const delta = (Math.random() - 0.46) * 7.0;
                        target = Math.max(-5.0, Math.min(10.0, +(target + delta).toFixed(1)));
                    }
                    ticksRemaining -= 1;
                    const diff = target - current;
                    const maxStep = 0.3;
                    if (Math.abs(diff) <= maxStep) {
                        current = target;
                    } else {
                        current = +(current + Math.sign(diff) * maxStep).toFixed(2);
                    }
                } else if (mode === 'difficult') {
                    if (ticksRemaining <= 0) {
                        ticksRemaining = 6 + Math.floor(Math.random() * 7);
                        const rawTarget = -5.0 + Math.random() * 15.0;
                        target = Math.max(-5.0, Math.min(10.0, +rawTarget.toFixed(1)));
                    }
                    ticksRemaining -= 1;
                    const diff = target - current;
                    const maxStep = 0.85;
                    if (Math.abs(diff) <= maxStep) {
                        current = target;
                    } else {
                        current = +(current + Math.sign(diff) * maxStep).toFixed(2);
                    }
                }
                if (s > 0) {
                    elevationMeters += 8.5 * (current / 100.0);
                }
                profile.push({ current, target, elevationMeters: +elevationMeters.toFixed(2) });
            }
            return profile;
        }

        function syncGradientAtSecond(sec) {
            if (!state.gradientProfile || state.gradientProfile.length === 0) {
                if (state.workout) {
                    state.gradientProfile = generateTerrainGradientProfile(state.workout.totalDuration, state.resistanceMode);
                } else {
                    state.currentGradientPct = 0.0;
                    state.targetGradientPct = 0.0;
                    return;
                }
            }
            const idx = Math.max(0, Math.min(state.gradientProfile.length - 1, Math.floor(sec)));
            const entry = state.gradientProfile[idx];
            state.currentGradientPct = entry.current;
            state.targetGradientPct = entry.target;
        }

        function stepTerrainGradient() {
            syncGradientAtSecond(state.elapsedSec);
        }

        const GROUND_NEAR_TOUCH_ALTITUDE_Y = 1.35;
        const SESSION_MIN_TARGET_GATE_ALTITUDE_Y = 7.0;

        /**
         * Returns the minimum target watt value across the entire workout session.
         */
        function getSessionMinTargetWatts(workout, ftp) {
            const refFtp = Math.max(100, ftp || 200);
            if (!workout || !workout.segments || workout.segments.length === 0) {
                return Math.round(refFtp * 0.50);
            }
            let minWatts = Infinity;
            for (let i = 0; i < workout.segments.length; i++) {
                const seg = workout.segments[i];
                const wStart = resolveWatts(seg.startPower, refFtp);
                const wEnd = resolveWatts(seg.endPower, refFtp);
                if (wStart < minWatts) minWatts = wStart;
                if (wEnd < minWatts) minWatts = wEnd;
            }
            return Number.isFinite(minWatts) ? Math.max(25, minWatts) : Math.round(refFtp * 0.50);
        }

        function getSessionMaxTargetWatts(workout, ftp) {
            const refFtp = Math.max(100, ftp || 200);
            if (!workout || !workout.segments || workout.segments.length === 0) {
                return refFtp;
            }
            let maxWatts = 0;
            for (let i = 0; i < workout.segments.length; i++) {
                const seg = workout.segments[i];
                const wStart = resolveWatts(seg.startPower, refFtp);
                const wEnd = resolveWatts(seg.endPower, refFtp);
                if (wStart > maxWatts) maxWatts = wStart;
                if (wEnd > maxWatts) maxWatts = wEnd;
            }
            return maxWatts > 0 ? maxWatts : refFtp;
        }

        function getAltitudeScaleFtp(workout, ftp) {
            const refFtp = Math.max(100, ftp || 200);
            const minW = getSessionMinTargetWatts(workout, refFtp);
            const maxW = getSessionMaxTargetWatts(workout, refFtp);
            return Math.max(refFtp, (maxW + 50 - minW) / 2.45);
        }

        /**
         * Maps a power value (watts) to a 3D sky altitude (Y coordinate in Three.js world units).
         * - Offsets all gates downwards so that the minimum watt target of the entire session sits
         *   slightly above ground (`SESSION_MIN_TARGET_GATE_ALTITUDE_Y = 7.0`).
         * - When not pedaling or 0 watts are simulated (`clampedWatts <= 0`), the dragon drops so it is
         *   almost touching the ground (`GROUND_NEAR_TOUCH_ALTITUDE_Y = 1.35`).
         */
        function wattsToSkyAltitudeY(watts, ftp, gradientPct = 0) {
            const refFtp = Math.max(100, ftp || 200);
            const clampedWatts = Math.max(0, Number(watts) || 0);
            if (clampedWatts <= 0) {
                return GROUND_NEAR_TOUCH_ALTITUDE_Y;
            }
            const minSessionWatts = getSessionMinTargetWatts(state.workout, refFtp);
            if (clampedWatts < minSessionWatts) {
                const rampFrac = clampedWatts / Math.max(1, minSessionWatts);
                return GROUND_NEAR_TOUCH_ALTITUDE_Y + rampFrac * (SESSION_MIN_TARGET_GATE_ALTITUDE_Y - GROUND_NEAR_TOUCH_ALTITUDE_Y);
            }
            const scaleFtp = getAltitudeScaleFtp(state.workout, refFtp);
            const normalized = Math.max(0, Math.min(2.50, (clampedWatts - minSessionWatts) / scaleFtp));
            return 7.0 + normalized * 48.0;
        }

        function getAccuracyToleranceWatts() {
            const raw = Number(state.accuracyToleranceWatts);
            if (!Number.isFinite(raw)) return 40;
            return Math.max(5, Math.min(50, Math.round(raw)));
        }

        function getAccuracyToleranceFraction(targetWatts = state.ftp) {
            const clampedTarget = Math.max(25, Number(targetWatts) || 250);
            return getAccuracyToleranceWatts() / clampedTarget;
        }

        /**
         * Computes the 3D donut gate radius in world Y units so that it scales with the configurable
         * absolute watt accuracy tolerance (5W to 50W, i.e. `[targetWatts - tolWatts, targetWatts + tolWatts]`).
         * Keep `clampedTarget * 0.95` and `clampedTarget * 1.05` reference baseline in calculation.
         * Uses the linear above-minimum slope (48.0 world units per FTP) so that a gate at `minSessionWatts`
         * remains strictly above ground while its radius matches the ±toleranceWatts band.
         */
        function getDonutRadiusForTargetWatts(targetWatts, ftp, gradientPct = 0, toleranceWatts = getAccuracyToleranceWatts()) {
            const refFtp = Math.max(100, ftp || 200);
            const scaleFtp = getAltitudeScaleFtp(state.workout, refFtp);
            const clampedTarget = Math.max(25, Number(targetWatts) || 0);
            const tolW = Math.max(5, Math.min(50, Number(toleranceWatts) || 30));
            const centerY = wattsToSkyAltitudeY(clampedTarget, ftp, gradientPct);
            const refMin5 = wattsToSkyAltitudeY(clampedTarget * 0.95, ftp, gradientPct);
            const refMax5 = wattsToSkyAltitudeY(clampedTarget * 1.05, ftp, gradientPct);
            const maxZoneY = wattsToSkyAltitudeY(clampedTarget + tolW, ftp, gradientPct);
            const linearZoneRadius = (tolW / scaleFtp) * 48.0;
            const rawZoneRadius = Math.max(Math.abs(maxZoneY - centerY), linearZoneRadius, Math.abs(refMax5 - refMin5) * 0.01);
            return rawZoneRadius;
        }

        /**
         * Simulates dynamic, non-periodic random left and right canyon turns along the forward Z axis.
         * Uses a variable-length random-walk cubic Hermite waypoint spline layered with multi-scale
         * hashed quintic value noise so canyon directions feel genuinely random rather than a waveform.
         */
        let canyonCourseSeed = (Math.floor(Math.random() * 0x7fffffff) || 133742);
        let canyonWaypoints = [];
        let canyonMinGeneratedZ = 0;
        let canyonMaxGeneratedZ = 0;

        function canyonHashUnit(index, channel = 0) {
            let h = Math.imul((index | 0) ^ Math.imul(channel | 0, 0x9e3779b9), 0x85ebca6b);
            h = Math.imul(h ^ (canyonCourseSeed | 0), 0xc2b2ae35);
            h ^= h >>> 16;
            h = Math.imul(h, 0x27d4eb2d);
            h ^= h >>> 15;
            return (h >>> 0) / 4294967296.0;
        }

        function canyonHashSigned(index, channel = 0) {
            return canyonHashUnit(index, channel) * 2.0 - 1.0;
        }

        function computeCanyonStepParams(stepIndex, prevX, prevHeadingSlope) {
            const rLen1 = canyonHashUnit(stepIndex, 1);
            const rLen2 = canyonHashUnit(stepIndex, 2);
            // Variable segment lengths: short doglegs (95-145), medium curves (145-225), or long sweeps/straights (225-320)
            let segLenZ;
            if (rLen1 < 0.30) {
                segLenZ = 95.0 + rLen2 * 50.0;
            } else if (rLen1 < 0.72) {
                segLenZ = 145.0 + rLen2 * 80.0;
            } else {
                segLenZ = 225.0 + rLen2 * 95.0;
            }

            const rMode = canyonHashUnit(stepIndex, 3);
            const rDir = canyonHashUnit(stepIndex, 4);
            const rMag = canyonHashUnit(stepIndex, 5);

            let headingSlope;
            if (rMode < 0.22) {
                // Straightaway or subtle diagonal canyon drift
                headingSlope = prevHeadingSlope * 0.20 + (rDir - 0.5) * 0.11;
            } else if (rMode < 0.58 && Math.abs(prevHeadingSlope) > 0.03) {
                // Compound turn: continue bending in the same direction (avoids regular back-and-forth wave oscillation)
                const sameDir = Math.sign(prevHeadingSlope);
                const mag = 0.08 + Math.pow(rMag, 0.85) * 0.30;
                headingSlope = sameDir * mag;
            } else {
                // Independent random turn direction and curvature intensity
                const dir = rDir < 0.5 ? -1.0 : 1.0;
                const mag = 0.09 + Math.pow(rMag, 0.78) * 0.33;
                headingSlope = dir * mag;
            }

            // Soft boundary guidance only when wandering far from the origin so the canyon can roam freely without drifting to infinity
            if (Math.abs(prevX) > 175.0) {
                const pullBackDir = -Math.sign(prevX);
                const pullStrength = Math.min(1.0, (Math.abs(prevX) - 175.0) / 95.0);
                headingSlope = headingSlope * (1.0 - 0.65 * pullStrength) + pullBackDir * (0.14 + 0.18 * rMag) * pullStrength;
            }

            headingSlope = Math.max(-0.42, Math.min(0.42, headingSlope));
            return { segLenZ, headingSlope };
        }

        function recomputeCanyonWaypointTangents() {
            const n = canyonWaypoints.length;
            if (n === 0) return;
            if (n === 1) {
                canyonWaypoints[0].m = 0;
                return;
            }
            for (let i = 0; i < n; i++) {
                if (i === 0) {
                    const dz = canyonWaypoints[1].z - canyonWaypoints[0].z;
                    canyonWaypoints[0].m = dz !== 0 ? (canyonWaypoints[1].x - canyonWaypoints[0].x) / dz : 0;
                } else if (i === n - 1) {
                    const dz = canyonWaypoints[n - 1].z - canyonWaypoints[n - 2].z;
                    canyonWaypoints[n - 1].m = dz !== 0 ? (canyonWaypoints[n - 1].x - canyonWaypoints[n - 2].x) / dz : 0;
                } else {
                    const dzPrev = canyonWaypoints[i].z - canyonWaypoints[i - 1].z;
                    const dzNext = canyonWaypoints[i + 1].z - canyonWaypoints[i].z;
                    const dPrev = dzPrev !== 0 ? (canyonWaypoints[i].x - canyonWaypoints[i - 1].x) / dzPrev : 0;
                    const dNext = dzNext !== 0 ? (canyonWaypoints[i + 1].x - canyonWaypoints[i].x) / dzNext : 0;
                    const lenPrev = Math.abs(dzPrev);
                    const lenNext = Math.abs(dzNext);
                    const weightedSlope = (lenNext * dPrev + lenPrev * dNext) / Math.max(1e-5, lenPrev + lenNext);
                    const tangentJitter = 0.78 + 0.40 * canyonHashUnit(canyonWaypoints[i].idx, 6);
                    canyonWaypoints[i].m = Math.max(-0.45, Math.min(0.45, weightedSlope * tangentJitter));
                }
            }
        }

        function ensureCanyonWaypointsCoverZ(targetZ) {
            if (canyonWaypoints.length === 0) {
                canyonWaypoints = [{ idx: 0, z: 0, x: 0, m: 0, headingSlope: (canyonHashSigned(0, 7) * 0.16) }];
                canyonMinGeneratedZ = 0;
                canyonMaxGeneratedZ = 0;
            }

            let changed = false;
            // Extend forward into negative Z (flight direction)
            while (canyonMinGeneratedZ > targetZ - 900) {
                const first = canyonWaypoints[0];
                const nextIdx = first.idx - 1;
                const { segLenZ, headingSlope } = computeCanyonStepParams(nextIdx, first.x, first.headingSlope);
                const nextZ = first.z - segLenZ;
                const nextX = first.x + headingSlope * segLenZ;
                canyonWaypoints.unshift({
                    idx: nextIdx,
                    z: nextZ,
                    x: nextX,
                    m: 0,
                    headingSlope
                });
                canyonMinGeneratedZ = nextZ;
                changed = true;
            }

            // Extend backward into positive Z (behind start line)
            while (canyonMaxGeneratedZ < targetZ + 600) {
                const last = canyonWaypoints[canyonWaypoints.length - 1];
                const nextIdx = last.idx + 1;
                const { segLenZ, headingSlope } = computeCanyonStepParams(nextIdx, last.x, last.headingSlope);
                const nextZ = last.z + segLenZ;
                const nextX = last.x - headingSlope * segLenZ;
                canyonWaypoints.push({
                    idx: nextIdx,
                    z: nextZ,
                    x: nextX,
                    m: 0,
                    headingSlope
                });
                canyonMaxGeneratedZ = nextZ;
                changed = true;
            }

            if (changed) {
                recomputeCanyonWaypointTangents();
            }
        }

        function regenerateRandomCanyonPath(newSeed = null) {
            canyonCourseSeed = (newSeed !== null && Number.isFinite(newSeed))
                ? (Math.floor(newSeed) || 133742)
                : (Math.floor(Math.random() * 0x7fffffff) || 133742);
            canyonWaypoints = [];
            canyonMinGeneratedZ = 0;
            canyonMaxGeneratedZ = 0;
            ensureCanyonWaypointsCoverZ(-3600);
            ensureCanyonWaypointsCoverZ(800);
        }

        function sampleCanyonValueNoise(worldZ, scale, amplitude, channel) {
            const u = worldZ / scale;
            const i = Math.floor(u);
            const f = u - i;
            const v0 = canyonHashSigned(i, channel);
            const v1 = canyonHashSigned(i + 1, channel);
            // Quintic C2 smoothstep: w(f) = 6f^5 - 15f^4 + 10f^3, w'(f) = 30f^2(1-f)^2
            const f2 = f * f;
            const f3 = f2 * f;
            const w = f3 * (10.0 - 15.0 * f + 6.0 * f2);
            const dwDf = 30.0 * f2 * (1.0 - f) * (1.0 - f);
            return {
                value: amplitude * (v0 + (v1 - v0) * w),
                derivative: (amplitude / scale) * (v1 - v0) * dwDf
            };
        }

        function evaluateCanyonSplineAtZ(worldZ) {
            const z = Number(worldZ) || 0;
            ensureCanyonWaypointsCoverZ(z);

            // Binary search for segment [lo, lo+1] containing z (canyonWaypoints is sorted in ascending Z order)
            let lo = 0;
            let hi = canyonWaypoints.length - 2;
            while (lo <= hi) {
                const mid = (lo + hi) >>> 1;
                if (canyonWaypoints[mid].z <= z) {
                    if (z <= canyonWaypoints[mid + 1].z) {
                        lo = mid;
                        break;
                    }
                    lo = mid + 1;
                } else {
                    hi = mid - 1;
                }
            }
            const idx = Math.max(0, Math.min(canyonWaypoints.length - 2, lo));
            const p0 = canyonWaypoints[idx];
            const p1 = canyonWaypoints[idx + 1];
            const dz = p1.z - p0.z;
            if (Math.abs(dz) < 1e-6) {
                return { x: p0.x, dxDz: p0.m };
            }

            const t = Math.max(0, Math.min(1, (z - p0.z) / dz));
            const t2 = t * t;
            const t3 = t2 * t;

            // Cubic Hermite basis functions and exact derivatives
            const h00 = 2.0 * t3 - 3.0 * t2 + 1.0;
            const h10 = t3 - 2.0 * t2 + t;
            const h01 = -2.0 * t3 + 3.0 * t2;
            const h11 = t3 - t2;

            const splineX = h00 * p0.x + h10 * dz * p0.m + h01 * p1.x + h11 * dz * p1.m;

            const dh00 = 6.0 * t2 - 6.0 * t;
            const dh10 = 3.0 * t2 - 4.0 * t + 1.0;
            const dh01 = -6.0 * t2 + 6.0 * t;
            const dh11 = 3.0 * t2 - 2.0 * t;

            const splineDxDz = (dh00 * p0.x + dh01 * p1.x) / dz + dh10 * p0.m + dh11 * p1.m;

            // Layer non-periodic hashed value noise for organic canyon wall/river meander
            const n1 = sampleCanyonValueNoise(z, 113.0, 5.6, 11);
            const n2 = sampleCanyonValueNoise(z, 53.0, 2.0, 17);

            return {
                x: splineX + n1.value + n2.value,
                dxDz: splineDxDz + n1.derivative + n2.derivative
            };
        }

        // Initialize the random canyon path immediately
        regenerateRandomCanyonPath();

        function getSimulatedTurnOffsetX(worldZ) {
            return evaluateCanyonSplineAtZ(worldZ).x;
        }

        function getSimulatedTurnDerivativeX(worldZ) {
            return evaluateCanyonSplineAtZ(worldZ).dxDz;
        }

        const CANYON_MAX_STEER_OFFSET_X = 24.0;
        // Ghost ride rendering: flies beside the course centerline; the distance gap is shown as a clamped forward/backward offset
        const GHOST_LATERAL_OFFSET_X = 9.0;
        const GHOST_WORLD_UNITS_PER_METER = 1.5;
        const GHOST_MAX_Z_OFFSET = 60.0;
        const DRAGON_STEER_SPEED_X = 20.0;
        const DRAGON_HEADING_TURN_RATE = 1.15; // radians/sec yaw rate when steering left/right like a plane
        const DRAGON_MAX_HEADING_ANGLE = 0.72; // max heading angle (~41 degrees)
        const DRAGON_VERTICAL_SPRING = 10.5; // spring stiffness for smooth vertical (up/down) altitude inertia
        const DRAGON_VERTICAL_DAMPING = 6.5; // critical damping (~2*sqrt(k)) so up/down flight is smooth without overshoot
        const DRAGON_MAX_VERTICAL_SPEED = 28.0; // max vertical climb/descent speed in world units/sec
        const DRAGON_STEER_INERTIA_ACCEL = 5.5; // rotational acceleration smoothing when pressing left/right
        const DRAGON_STEER_INERTIA_DAMPING = 6.0; // rotational coasting/damping when releasing left/right
        const DRAGON_LATERAL_VELOCITY_SMOOTHING = 6.5; // horizontal velocity inertia smoothing for left/right movement
        const DRAGON_MAX_ROLL_ANGLE = 0.88; // max visual roll/bank angle (~50 degrees) when steering left/right
        const DRAGON_ROLL_STEER_INPUT_GAIN = 0.56; // direct visual roll response to left/right steering input
        const DRAGON_ROLL_YAW_RATE_GAIN = 0.34; // visual roll contribution from active yaw turn rate
        const DRAGON_ROLL_HEADING_GAIN = 0.22; // gentle bank when holding a heading offset across the canyon
        const DRAGON_ROLL_SMOOTHING = 7.5; // roll interpolation speed when steering
        const DRAGON_ROLL_RECOVERY_SMOOTHING = 6.0; // roll return-to-level speed when steering is released

        /**
         * Clamps the dragon's horizontal offset from the canyon centerline so the dragon always stays
         * inside the canyon walls and within the visible camera frustum on screen.
         */
        function clampDragonSteerOffsetX(offsetX, camera = null) {
            let maxAllowed = CANYON_MAX_STEER_OFFSET_X;
            if (camera && camera.aspect) {
                const camDist = 16.5;
                const halfFovRad = ((camera.fov || 68) * 0.5) * (Math.PI / 180);
                const visibleHalfWidth = Math.tan(halfFovRad) * camDist * Math.max(0.5, camera.aspect);
                const screenSafeLimit = Math.max(10.0, visibleHalfWidth * 1.45);
                maxAllowed = Math.min(CANYON_MAX_STEER_OFFSET_X, screenSafeLimit);
            }
            return Math.max(-maxAllowed, Math.min(maxAllowed, Number(offsetX) || 0));
        }

        /**
         * Clamps the dragon's 3D world X position so it cannot leave the canyon walls at `worldZ`,
         * aligns the dragon to the canyon direction when touching a canyon wall, and allows steering
         * inward away from the wall immediately.
         */
        function clampDragonWorldXToCanyon(worldX, worldZ, headingAngle = 0, camera = null, steerInput = 0) {
            const canyonCenterX = getSimulatedTurnOffsetX(worldZ);
            const maxOffset = Math.abs(clampDragonSteerOffsetX(CANYON_MAX_STEER_OFFSET_X, camera));
            const minWorldX = canyonCenterX - maxOffset;
            const maxWorldX = canyonCenterX + maxOffset;
            let clampedWorldX = Math.max(minWorldX, Math.min(maxWorldX, Number(worldX) || canyonCenterX));
            const canyonTangentHeading = Math.atan(-getSimulatedTurnDerivativeX(worldZ));
            const minHeading = canyonTangentHeading - DRAGON_MAX_HEADING_ANGLE;
            const maxHeading = canyonTangentHeading + DRAGON_MAX_HEADING_ANGLE;
            let clampedHeading = Math.max(minHeading, Math.min(maxHeading, Number(headingAngle) || 0));
            let hitWallSide = 0;
            if (clampedWorldX <= minWorldX + 1e-4) {
                hitWallSide = -1;
                if (steerInput <= 0 || clampedHeading < canyonTangentHeading || Math.sin(clampedHeading) < Math.sin(canyonTangentHeading)) {
                    clampedHeading = canyonTangentHeading;
                }
            } else if (clampedWorldX >= maxWorldX - 1e-4) {
                hitWallSide = 1;
                if (steerInput >= 0 || clampedHeading > canyonTangentHeading || Math.sin(clampedHeading) > Math.sin(canyonTangentHeading)) {
                    clampedHeading = canyonTangentHeading;
                }
            }
            return {
                worldX: clampedWorldX,
                offsetX: clampedWorldX - canyonCenterX,
                headingAngle: clampedHeading,
                canyonTangentHeading,
                hitWallSide
            };
        }

