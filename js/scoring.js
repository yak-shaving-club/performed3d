        // =========================================================================
        // 8. SCORING HELPERS & TIMELINE CANVAS RENDERING
        // =========================================================================
        const VALID_SCREENS = ['splash', 'pairing', 'training', 'avatar', 'game', 'summary'];

        function updateAvatarReadySummaryUI() {
            const summaryEl = document.getElementById('avatarReadySummary');
            if (!summaryEl || !state.workout) return;
            const dur = formatDuration(state.workout.totalDuration);
            const tol = getAccuracyToleranceWatts();
            const ghostSuffix = state.ghost ? ` • Ghost ${formatSwissNumber(state.ghost.finalScore)} pts` : '';
            summaryEl.textContent = `${state.workout.name} (${dur}) • FTP ${state.ftp}W • ±${tol}W Gate${ghostSuffix}`;
        }

        function updateHeaderAndSetupVisibility() {
            const current = VALID_SCREENS.includes(state.currentScreen) ? state.currentScreen : 'splash';
            const screenMap = {
                splash: document.getElementById('screenSplash'),
                pairing: document.getElementById('screenPairing'),
                training: document.getElementById('screenTraining'),
                avatar: document.getElementById('screenAvatar'),
                game: document.getElementById('screenGame'),
                summary: document.getElementById('summaryModal')
            };

            Object.entries(screenMap).forEach(([name, el]) => {
                if (!el) return;
                const active = name === current;
                el.classList.toggle('hidden', !active);
                el.classList.toggle('flex', active);
            });

            const wizardBar = document.getElementById('wizardHeaderBar');
            const showWizard = current === 'pairing' || current === 'training' || current === 'avatar';
            if (wizardBar) {
                wizardBar.classList.toggle('hidden', !showWizard);
            }

            const returnBtn = document.getElementById('wizardReturnToGameBtn');
            if (returnBtn) {
                returnBtn.classList.toggle('hidden', !state.hasStartedSession);
            }

            document.querySelectorAll('[data-step-nav]').forEach((btn) => {
                const step = btn.getAttribute('data-step-nav');
                if (step === current) {
                    btn.className = 'px-2.5 sm:px-3 py-1 rounded-xl text-xs font-black transition cursor-pointer border bg-amber-500/20 text-amber-300 border-amber-400/50 shadow';
                } else {
                    btn.className = 'px-2.5 sm:px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer border bg-gray-900/80 hover:bg-gray-800 text-gray-300 border-gray-800';
                }
            });

            const fireContainer = document.getElementById('fireBreathContainer');
            if (fireContainer) {
                fireContainer.classList.toggle('hidden', !state.renderObstacles);
            }

            updateAvatarReadySummaryUI();
        }

        function setScreen(screenName) {
            const target = VALID_SCREENS.includes(screenName) ? screenName : 'splash';
            state.currentScreen = target;
            state.steerLeftPressed = false;
            state.steerRightPressed = false;
            updateHeaderAndSetupVisibility();
            requestAnimationFrame(() => {
                updateLiveHud();
            });
        }

        function estimateSpeedMpsFromWatts(watts) {
            if (watts <= 0) return 0;
            return Math.max(0, Math.pow(watts / 0.22, 1 / 3));
        }

        function recordKickrWattReading(watts, nowMs = performance.now()) {
            const clampedWatts = Math.max(0, Number(watts) || 0);
            state.rawKickrWatts = clampedWatts;
            if (clampedWatts > 0) {
                state.lastKickrPedalTimestampMs = nowMs;
            }
            state.kickrWattSamples.push({ timestampMs: nowMs, watts: clampedWatts });
            return getThreeSecondAverageKickrWatts(nowMs);
        }

        function getThreeSecondAverageKickrWatts(nowMs = performance.now()) {
            const cutoffMs = nowMs - DRAGON_POWER_AVG_WINDOW_MS;
            while (state.kickrWattSamples.length > 0 && state.kickrWattSamples[0].timestampMs < cutoffMs) {
                state.kickrWattSamples.shift();
            }
            if (state.kickrWattSamples.length === 0) {
                // If no BLE power packet arrived within the 3s window, decay to 0W when rider stops pedaling
                if (state.lastKickrPedalTimestampMs > 0 && (nowMs - state.lastKickrPedalTimestampMs) > DRAGON_POWER_AVG_WINDOW_MS) {
                    return 0;
                }
                return state.rawKickrWatts || 0;
            }
            let weightedSum = 0;
            let weightTotal = 0;
            for (let i = 0; i < state.kickrWattSamples.length; i++) {
                const weight = i + 1;
                weightedSum += state.kickrWattSamples[i].watts * weight;
                weightTotal += weight;
            }
            return Math.round(weightedSum / weightTotal);
        }

        const bleHrmSensor = new BleHeartRateMonitor(
            (bpm) => {
                state.heartRate = (bpm !== null && bpm !== undefined && bpm > 0) ? Math.round(bpm) : null;
                bleEliteAriaFan.setHeartRate(state.heartRate).catch((err) => {
                    console.error('Could not update Elite Aria fan speed.', err);
                    bleEliteAriaFan.onStatus('error', 'Elite Aria control error');
                });
                updateLiveHud();
            },
            (status, label) => {
                const btn = document.getElementById('connectHrmBleBtn');
                const text = document.getElementById('bleHrmStatusText');
                const dot = document.getElementById('bleHrmStatusDot');
                if (text) text.textContent = label;
                if (!btn || !dot) return;
                if (status === 'connected') {
                    btn.className = 'px-2.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/40';
                    dot.className = 'w-2 h-2 rounded-full bg-emerald-200 animate-ping';
                } else if (status === 'connecting') {
                    dot.className = 'w-2 h-2 rounded-full bg-amber-300 animate-pulse';
                } else {
                    btn.className = 'px-2.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md bg-rose-700/80 hover:bg-rose-600 text-white border border-rose-400/30';
                    dot.className = 'w-2 h-2 rounded-full bg-gray-300';
                }
            }
        );

        const bleEliteAriaFan = new BleEliteAriaFan(
            (status, label) => {
                const btn = document.getElementById('connectAriaBleBtn');
                const text = document.getElementById('bleAriaStatusText');
                const dot = document.getElementById('bleAriaStatusDot');
                if (text) text.textContent = label;
                if (!btn || !dot) return;
                if (status === 'connected') {
                    btn.className = 'px-2.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/40';
                    dot.className = 'w-2 h-2 rounded-full bg-emerald-200 animate-ping';
                } else if (status === 'connecting') {
                    dot.className = 'w-2 h-2 rounded-full bg-amber-300 animate-pulse';
                } else if (status === 'error') {
                    btn.className = 'px-2.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md bg-rose-700/80 hover:bg-rose-600 text-white border border-rose-400/30';
                    dot.className = 'w-2 h-2 rounded-full bg-rose-300';
                } else {
                    btn.className = 'px-2.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md bg-orange-700/80 hover:bg-orange-600 text-white border border-orange-400/30';
                    dot.className = 'w-2 h-2 rounded-full bg-gray-300';
                }
            }
        );

        const bleCadenceSensor = new BleCyclingSpeedCadenceSensor(
            'cadence',
            (measurement) => {
                if (measurement.cadence !== null && measurement.cadence !== undefined) {
                    state.cadence = Math.max(0, Math.round(measurement.cadence));
                }
                if (!bleSpeedSensor.connected && measurement.speedKmh !== null && measurement.speedKmh !== undefined) {
                    state.speedKmh = Math.max(0, measurement.speedKmh);
                }
                updateLiveHud();
            },
            (status, label) => {
                const btn = document.getElementById('connectCadenceBleBtn');
                const text = document.getElementById('bleCadenceStatusText');
                const dot = document.getElementById('bleCadenceStatusDot');
                if (text) text.textContent = label;
                if (!btn || !dot) return;
                if (status === 'connected') {
                    btn.className = 'px-2.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/40';
                    dot.className = 'w-2 h-2 rounded-full bg-emerald-200 animate-ping';
                } else if (status === 'connecting') {
                    dot.className = 'w-2 h-2 rounded-full bg-amber-300 animate-pulse';
                } else {
                    btn.className = 'px-2.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md bg-emerald-700/80 hover:bg-emerald-600 text-white border border-emerald-400/30';
                    dot.className = 'w-2 h-2 rounded-full bg-gray-300';
                }
            }
        );

        const bleSpeedSensor = new BleCyclingSpeedCadenceSensor(
            'speed',
            (measurement) => {
                if (measurement.speedKmh !== null && measurement.speedKmh !== undefined) {
                    state.speedKmh = Math.max(0, measurement.speedKmh);
                }
                if (!bleCadenceSensor.connected && measurement.cadence !== null && measurement.cadence !== undefined) {
                    state.cadence = Math.max(0, Math.round(measurement.cadence));
                }
                updateLiveHud();
            },
            (status, label) => {
                const btn = document.getElementById('connectSpeedBleBtn');
                const text = document.getElementById('bleSpeedStatusText');
                const dot = document.getElementById('bleSpeedStatusDot');
                if (text) text.textContent = label;
                if (!btn || !dot) return;
                if (status === 'connected') {
                    btn.className = 'px-2.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/40';
                    dot.className = 'w-2 h-2 rounded-full bg-emerald-200 animate-ping';
                } else if (status === 'connecting') {
                    dot.className = 'w-2 h-2 rounded-full bg-amber-300 animate-pulse';
                } else {
                    btn.className = 'px-2.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md bg-cyan-700/80 hover:bg-cyan-600 text-white border border-cyan-400/30';
                    dot.className = 'w-2 h-2 rounded-full bg-gray-300';
                }
            }
        );

        const bleSteeringSensor = new BleEliteSteeringSensor(
            (normalizedInput, angleDeg) => {
                state.bleSteerInput = normalizedInput || 0.0;
                state.bleSteerAngleDeg = (angleDeg !== null && angleDeg !== undefined) ? angleDeg : 0.0;
                const text = document.getElementById('bleSteerStatusText');
                if (text && bleSteeringSensor.connected) {
                    const nameLabel = (bleSteeringSensor.device && bleSteeringSensor.device.name) || 'Sterzo / Rizer';
                    const degStr = (state.bleSteerAngleDeg >= 0 ? '+' : '') + state.bleSteerAngleDeg.toFixed(1) + '°';
                    text.textContent = `${nameLabel} (${degStr})`;
                }
            },
            (status, label) => {
                const btn = document.getElementById('connectSteerBleBtn');
                const text = document.getElementById('bleSteerStatusText');
                const dot = document.getElementById('bleSteerStatusDot');
                if (text) text.textContent = label;
                if (!btn || !dot) return;
                if (status === 'connected') {
                    btn.className = 'px-2.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/40';
                    dot.className = 'w-2 h-2 rounded-full bg-emerald-200 animate-ping';
                } else if (status === 'connecting') {
                    dot.className = 'w-2 h-2 rounded-full bg-amber-300 animate-pulse';
                } else {
                    btn.className = 'px-2.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md bg-purple-700/80 hover:bg-purple-600 text-white border border-purple-400/30';
                    dot.className = 'w-2 h-2 rounded-full bg-gray-300';
                }
            }
        );

        const phoneSteeringSensor = new PhoneWebRtcSteeringSensor(
            (normalizedInput, angleDeg) => {
                state.phoneSteerInput = normalizedInput || 0.0;
                state.phoneSteerAngleDeg = (angleDeg !== null && angleDeg !== undefined) ? angleDeg : 0.0;
                const degStr = (state.phoneSteerAngleDeg >= 0 ? '+' : '') + state.phoneSteerAngleDeg.toFixed(1) + '°';
                const text = document.getElementById('phoneSteerStatusText');
                if (text && phoneSteeringSensor.connected) {
                    text.textContent = `Phone (${degStr})`;
                }
                const modalAngle = document.getElementById('phoneSteerModalAngle');
                if (modalAngle) {
                    modalAngle.textContent = degStr;
                }
            },
            () => {
                if (dragon3D) {
                    dragon3D.triggerDragonFireBreath();
                }
            },
            (status, label) => {
                const btn = document.getElementById('connectPhoneSteerBtn');
                const text = document.getElementById('phoneSteerStatusText');
                const dot = document.getElementById('phoneSteerStatusDot');
                const modalStatus = document.getElementById('phoneSteerModalStatus');
                const disconnectBtn = document.getElementById('phoneSteerDisconnectBtn');
                if (text) text.textContent = label;
                if (status === 'connected') {
                    if (!state.steeringEnabled) setSteeringEnabled(true);
                    if (btn) btn.className = 'px-2.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/40';
                    if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-200 animate-ping';
                    if (modalStatus) {
                        modalStatus.textContent = 'Phone connected! Turn handlebar to steer.';
                        modalStatus.className = 'font-bold text-emerald-300';
                    }
                    if (disconnectBtn) disconnectBtn.classList.remove('hidden');
                } else if (status === 'connecting') {
                    if (dot) dot.className = 'w-2 h-2 rounded-full bg-amber-300 animate-pulse';
                    if (modalStatus) {
                        modalStatus.textContent = 'Waiting for phone to scan QR code...';
                        modalStatus.className = 'font-bold text-indigo-300';
                    }
                    if (disconnectBtn) disconnectBtn.classList.add('hidden');
                } else {
                    if (btn) btn.className = 'px-2.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md bg-indigo-700/80 hover:bg-indigo-600 text-white border border-indigo-400/30';
                    if (dot) dot.className = 'w-2 h-2 rounded-full bg-gray-300';
                    if (modalStatus) {
                        modalStatus.textContent = 'Disconnected. Scan QR code to connect.';
                        modalStatus.className = 'font-bold text-gray-400';
                    }
                    if (disconnectBtn) disconnectBtn.classList.add('hidden');
                }
            }
        );

        const bleTrainer = new WahooKickrBluetooth(
            (telemetry) => {
                if (telemetry.watts !== null && telemetry.watts !== undefined) {
                    state.actualWatts = recordKickrWattReading(telemetry.watts);
                } else if (state.kickrWattSamples.length > 0) {
                    state.actualWatts = getThreeSecondAverageKickrWatts();
                }
                if (!bleCadenceSensor.connected) {
                    if (telemetry.cadence !== null && telemetry.cadence !== undefined) {
                        state.cadence = Math.max(0, Math.round(telemetry.cadence));
                    } else if (state.actualWatts <= 0) {
                        state.cadence = 0;
                    } else if (state.cadence === 0) {
                        state.cadence = 85;
                    }
                }
                if (!bleSpeedSensor.connected) {
                    if (telemetry.speedKmh !== null && telemetry.speedKmh !== undefined) {
                        state.speedKmh = telemetry.speedKmh;
                    } else {
                        state.speedKmh = estimateSpeedMpsFromWatts(state.actualWatts) * 3.6;
                    }
                }
                updateLiveHud();
            },
            (status, label) => {
                const btn = document.getElementById('connectBleBtn');
                const text = document.getElementById('bleStatusText');
                const dot = document.getElementById('bleStatusDot');
                text.textContent = label;
                if (status === 'connected') {
                    btn.className = 'px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-md bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/40';
                    dot.className = 'w-2 h-2 rounded-full bg-emerald-200 animate-ping';
                } else if (status === 'connecting') {
                    dot.className = 'w-2 h-2 rounded-full bg-amber-300 animate-pulse';
                } else {
                    btn.className = 'px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-md bg-blue-600 hover:bg-blue-500 text-white border border-blue-400/30';
                    dot.className = 'w-2 h-2 rounded-full bg-gray-300';
                }
            }
        );

        const bleRower = new BleConcept2Rower(
            (telemetry) => {
                if (telemetry.watts !== null && telemetry.watts !== undefined) {
                    state.actualWatts = recordKickrWattReading(telemetry.watts);
                }
                if (!bleCadenceSensor.connected && telemetry.cadence !== null && telemetry.cadence !== undefined) {
                    state.cadence = Math.max(0, Math.round(telemetry.cadence));
                }
                if (!bleSpeedSensor.connected && telemetry.speedKmh !== null && telemetry.speedKmh !== undefined) {
                    state.speedKmh = Math.max(0, telemetry.speedKmh);
                }
                const rowerHeartRate = telemetry.heartRate || null;
                if (!bleHrmSensor.connected && rowerHeartRate !== state.heartRate) {
                    state.heartRate = rowerHeartRate;
                    bleEliteAriaFan.setHeartRate(state.heartRate).catch((err) => {
                        console.error('Could not update Elite Aria fan speed.', err);
                        bleEliteAriaFan.onStatus('error', 'Elite Aria control error');
                    });
                }
                updateLiveHud();
            },
            (status, label) => {
                const btn = document.getElementById('connectRowerBleBtn');
                const text = document.getElementById('bleRowerStatusText');
                const dot = document.getElementById('bleRowerStatusDot');
                if (text) text.textContent = label;
                if (!btn || !dot) return;
                if (status === 'connected') {
                    btn.className = 'px-2.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/40';
                    dot.className = 'w-2 h-2 rounded-full bg-emerald-200 animate-ping';
                } else if (status === 'connecting') {
                    dot.className = 'w-2 h-2 rounded-full bg-amber-300 animate-pulse';
                } else {
                    btn.className = 'px-2.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md bg-sky-700/80 hover:bg-sky-600 text-white border border-sky-400/30';
                    dot.className = 'w-2 h-2 rounded-full bg-gray-300';
                }
            }
        );

        function formatDuration(sec) {
            const total = Math.max(0, Math.floor(sec));
            const mins = Math.floor(total / 60);
            const rem = total % 60;
            const hrs = Math.floor(mins / 60);
            if (hrs > 0) {
                return `${hrs}:${String(mins % 60).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
            }
            return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
        }

        // Format integer values using Swiss German (de-CH) apostrophe (') thousands delimiter
        function formatSwissNumber(num) {
            const rounded = Math.round(Number(num) || 0);
            const sign = rounded < 0 ? '-' : '';
            return sign + Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
        }

        function evaluateAccuracyTick(
            actualWatts,
            targetWatts,
            currentStreak,
            flewThroughDonut = true,
            dragonAltitudeDiff = 0,
            donutRadius = 0,
            toleranceWatts = getAccuracyToleranceWatts()
        ) {
            if (targetWatts <= 0 || actualWatts <= 0 || !flewThroughDonut) {
                return { inZone: false, isBullseye: false, points: 0, ratioPct: 100, errorPct: 0, accuracyFactor: 0, combo: 1.0 };
            }
            const tolW = Math.max(5, Math.min(50, Number(toleranceWatts) || 30));
            const ratioPct = (actualWatts / targetWatts) * 100;
            const errorWatts = Math.abs(actualWatts - targetWatts);
            const errorPct = (errorWatts / targetWatts) * 100;

            if (errorWatts > tolW) {
                return {
                    inZone: false,
                    isBullseye: false,
                    points: 0,
                    ratioPct,
                    errorPct,
                    accuracyFactor: 0,
                    combo: 1.0
                };
            }

            const accuracyFactor = Math.max(0, Math.min(1, (tolW - errorWatts) / tolW));
            const basePoints = Math.round(15 + 85 * Math.pow(accuracyFactor, 1.25));
            const newStreak = currentStreak + 1;
            const combo = Math.min(4.0, +(1.0 + Math.floor(newStreak / 5) * 0.25).toFixed(2));
            const points = Math.round(basePoints * combo);
            const isBullseye = errorWatts <= Math.max(2, tolW * 0.25);

            return {
                inZone: true,
                isBullseye,
                points,
                ratioPct,
                errorPct,
                accuracyFactor,
                combo
            };
        }

        function spawnFloatingScorePopup(points, isBullseye, ratioPct, customSubtitle) {
            const container = document.getElementById('floatingScoreContainer');
            const el = document.createElement('div');
            const leftPct = 44 + (Math.random() * 20 - 10);
            const topPct = 38 + (Math.random() * 14 - 7);
            el.className = `floating-score absolute font-black font-mono text-center select-none ${
                isBullseye ? 'text-yellow-300 text-2xl drop-shadow-[0_0_12px_rgba(250,204,21,0.9)]' : 'text-emerald-300 text-xl drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]'
            }`;
            el.style.left = `${leftPct}%`;
            el.style.top = `${topPct}%`;
            const sub = customSubtitle || `${isBullseye ? 'DONUT BULLSEYE ' : 'GATE CLEAR '}${ratioPct.toFixed(1)}%`;
            el.innerHTML = `+${points} PTS<div class="text-[10px] font-bold uppercase tracking-wider">${sub}</div>`;
            container.appendChild(el);
            setTimeout(() => el.remove(), 1150);
        }

        const RING_STREAK_MILESTONE = 15;
        const RING_STREAK_BONUS_PER_TIER = 250;
        const RING_STREAK_TITLES = ['NICE STREAK!', 'ON FIRE!', 'UNSTOPPABLE!', 'DRAGON MASTER!', 'LEGENDARY!'];
        const RING_STREAK_COLORS = ['text-emerald-300', 'text-yellow-300', 'text-orange-400', 'text-fuchsia-400', 'text-cyan-300'];

        function spawnRingStreakSplash(ringCount, tier, bonusPts) {
            const container = document.getElementById('floatingScoreContainer');
            const el = document.createElement('div');
            const idx = Math.min(tier - 1, RING_STREAK_TITLES.length - 1);
            el.className = `streak-splash absolute font-black font-mono text-center select-none ${RING_STREAK_COLORS[idx]} drop-shadow-[0_0_24px_rgba(250,204,21,0.95)]`;
            el.style.left = '50%';
            el.style.top = '30%';
            el.innerHTML = `<div class="text-4xl sm:text-6xl tracking-wider">${RING_STREAK_TITLES[idx]}</div>`
                + `<div class="text-lg sm:text-2xl font-extrabold uppercase tracking-widest text-white mt-1">${ringCount} RINGS IN A ROW</div>`
                + `<div class="text-2xl sm:text-4xl mt-1 text-yellow-300">+${formatSwissNumber(bonusPts)} BONUS</div>`;
            container.appendChild(el);
            setTimeout(() => el.remove(), 2200);
        }

        function spawnFireballCostPopup(costPts) {
            const container = document.getElementById('floatingScoreContainer');
            const el = document.createElement('div');
            el.className = 'floating-score absolute font-black font-mono text-center select-none text-amber-300 text-lg sm:text-xl drop-shadow-[0_0_12px_rgba(249,115,22,0.9)]';
            el.style.left = '46%';
            el.style.top = '32%';
            el.innerHTML = `-${costPts} PTS<div class="text-[10px] font-extrabold uppercase tracking-wider text-orange-300">FIREBALL SHOT COST</div>`;
            container.appendChild(el);
            setTimeout(() => el.remove(), 950);
        }

        function spawnObstaclePenaltyPopup(penaltyPts) {
            const container = document.getElementById('floatingScoreContainer');
            const el = document.createElement('div');
            el.className = 'floating-score absolute font-black font-mono text-center select-none text-rose-400 text-2xl sm:text-3xl drop-shadow-[0_0_16px_rgba(244,63,94,0.95)]';
            el.style.left = '42%';
            el.style.top = '40%';
            el.innerHTML = `-${penaltyPts} PTS<div class="text-xs font-extrabold uppercase tracking-wider text-yellow-300">OBSTACLE IMPACT! PRESS SPACEBAR!</div>`;
            container.appendChild(el);
            setTimeout(() => el.remove(), 1250);
        }

        function spawnArrowHitPenaltyPopup(penaltyPts) {
            const container = document.getElementById('floatingScoreContainer');
            const el = document.createElement('div');
            el.className = 'floating-score absolute font-black font-mono text-center select-none text-rose-400 text-2xl sm:text-3xl drop-shadow-[0_0_16px_rgba(244,63,94,0.95)]';
            el.style.left = '43%';
            el.style.top = '36%';
            el.innerHTML = `-${penaltyPts} PTS<div class="text-xs font-extrabold uppercase tracking-wider text-amber-300">HUNTER ARROW HIT! STEER LEFT / RIGHT!</div>`;
            container.appendChild(el);
            setTimeout(() => el.remove(), 1200);
        }

        function getZoneColorForFraction(ftpFraction) {
            if (ftpFraction < 0.56) return { fill: 'rgba(148, 163, 184, 0.65)', stroke: '#94a3b8' };
            if (ftpFraction < 0.76) return { fill: 'rgba(59, 130, 246, 0.65)', stroke: '#60a5fa' };
            if (ftpFraction < 0.90) return { fill: 'rgba(16, 185, 129, 0.70)', stroke: '#34d399' };
            if (ftpFraction < 1.05) return { fill: 'rgba(250, 204, 21, 0.75)', stroke: '#fde047' };
            if (ftpFraction < 1.20) return { fill: 'rgba(249, 115, 22, 0.78)', stroke: '#fb923c' };
            return { fill: 'rgba(239, 68, 68, 0.80)', stroke: '#f87171' };
        }

        function drawRoundedRectPath(ctx, x, y, w, h, r) {
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(x, y, w, h, r);
            } else {
                const rad = Math.min(r, w / 2, h / 2);
                ctx.moveTo(x + rad, y);
                ctx.arcTo(x + w, y, x + w, y + h, rad);
                ctx.arcTo(x + w, y + h, x, y + h, rad);
                ctx.arcTo(x, y + h, x, y, rad);
                ctx.arcTo(x, y, x + w, y, rad);
                ctx.closePath();
            }
        }

        function drawTerrainDragonIcon(ctx, x, y, angleRad, scale = 1) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angleRad);
            ctx.scale(scale, scale);

            ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
            drawRoundedRectPath(ctx, -14, -16, 28, 20, 6);
            ctx.fill();

            ctx.fillStyle = '#ef4444';
            ctx.strokeStyle = '#fde047';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-10, -4);
            ctx.lineTo(0, -12);
            ctx.lineTo(10, -5);
            ctx.lineTo(2, -2);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.restore();
        }

        function renderWorkoutTimelinePlot(ctx, originX, originY, w, h, scale = 1) {
            if (!state.workout || w < 20 || h < 20) return;
            const padLeft = Math.round(40 * scale);
            const padRight = Math.round(34 * scale);
            const padTop = Math.round(10 * scale);
            const padBottom = Math.round(16 * scale);
            const plotW = Math.max(10, w - padLeft - padRight);
            const plotH = Math.max(10, h - padTop - padBottom);

            const workout = state.workout;
            const totalSec = Math.max(1, workout.totalDuration);

            let maxTargetW = state.ftp * 1.25;
            workout.segments.forEach(s => {
                maxTargetW = Math.max(maxTargetW, resolveWatts(s.startPower, state.ftp), resolveWatts(s.endPower, state.ftp));
            });
            state.samples.forEach(s => {
                maxTargetW = Math.max(maxTargetW, s.actualWatts);
            });
            const maxWattsScale = Math.ceil((maxTargetW * 1.15) / 50) * 50;

            function secToX(sec) {
                return originX + padLeft + (sec / totalSec) * plotW;
            }
            function wattsToY(watts) {
                return originY + padTop + plotH - Math.min(1, Math.max(0, watts / maxWattsScale)) * plotH;
            }

            let minElev = 0;
            let maxElev = 0;
            if (state.gradientProfile && state.gradientProfile.length > 0) {
                state.gradientProfile.forEach((p) => {
                    if (p.elevationMeters < minElev) minElev = p.elevationMeters;
                    if (p.elevationMeters > maxElev) maxElev = p.elevationMeters;
                });
            }
            const elevSpan = Math.max(15, maxElev - minElev);
            const terrainTopY = originY + padTop + plotH * 0.22;
            const terrainBottomY = originY + padTop + plotH * 0.88;
            const terrainBandH = terrainBottomY - terrainTopY;

            function elevationToY(elevMeters) {
                if (maxElev - minElev < 0.5) {
                    return originY + padTop + plotH * 0.72;
                }
                const norm = (elevMeters - minElev) / elevSpan;
                return terrainBottomY - norm * terrainBandH;
            }

            ctx.save();
            ctx.strokeStyle = 'rgba(51, 65, 85, 0.45)';
            ctx.lineWidth = Math.max(1, 1 * scale);
            ctx.fillStyle = '#64748b';
            ctx.font = `${Math.round(10 * scale)}px monospace`;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            const stepW = maxWattsScale > 550 ? 200 : (maxWattsScale > 350 ? 100 : 50);
            for (let gw = 0; gw <= maxWattsScale; gw += stepW) {
                const y = wattsToY(gw);
                ctx.beginPath();
                ctx.moveTo(originX + padLeft, y);
                ctx.lineTo(originX + w - padRight, y);
                ctx.stroke();
                ctx.fillText(`${gw}W`, originX + padLeft - Math.round(6 * scale), y);
            }

            workout.segments.forEach((seg) => {
                const x1 = secToX(seg.startSec);
                const x2 = secToX(seg.endSec);
                const w1 = resolveWatts(seg.startPower, state.ftp);
                const w2 = resolveWatts(seg.endPower, state.ftp);
                const y1 = wattsToY(w1);
                const y2 = wattsToY(w2);
                const bottomY = originY + padTop + plotH;

                const avgFrac = ((w1 + w2) / 2) / state.ftp;
                const colors = getZoneColorForFraction(avgFrac);

                ctx.fillStyle = colors.fill;
                ctx.strokeStyle = colors.stroke;
                ctx.lineWidth = 1.5 * scale;

                ctx.beginPath();
                ctx.moveTo(x1, bottomY);
                ctx.lineTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.lineTo(x2, bottomY);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            });

            if (state.gradientProfile && state.gradientProfile.length > 0) {
                const step = Math.max(1, Math.floor(totalSec / 450));
                const lastEntry = state.gradientProfile[state.gradientProfile.length - 1];

                ctx.save();
                ctx.lineWidth = 2.4 * scale;
                ctx.strokeStyle = '#facc15';
                ctx.beginPath();
                for (let s = 0; s <= totalSec; s += step) {
                    const gEntry = state.gradientProfile[Math.min(state.gradientProfile.length - 1, s)];
                    const sx = secToX(s);
                    const sy = elevationToY(gEntry.elevationMeters);
                    if (s === 0) ctx.moveTo(sx, sy);
                    else ctx.lineTo(sx, sy);
                }
                ctx.lineTo(secToX(totalSec), elevationToY(lastEntry.elevationMeters));
                ctx.stroke();
                ctx.restore();
            }

            if (state.samples.length > 0) {
                ctx.lineWidth = 2.2 * scale;
                ctx.strokeStyle = '#ffffff';
                ctx.beginPath();
                state.samples.forEach((samp, idx) => {
                    const sx = secToX(samp.elapsedSec);
                    const sy = wattsToY(samp.actualWatts);
                    if (idx === 0) ctx.moveTo(sx, sy);
                    else ctx.lineTo(sx, sy);
                });
                ctx.stroke();
            }

            const playheadX = secToX(state.elapsedSec);
            ctx.strokeStyle = '#f97316';
            ctx.lineWidth = 2 * scale;
            ctx.beginPath();
            ctx.moveTo(playheadX, originY + padTop);
            ctx.lineTo(playheadX, originY + padTop + plotH);
            ctx.stroke();

            if (state.gradientProfile && state.gradientProfile.length > 0) {
                const curIdx = Math.max(0, Math.min(state.gradientProfile.length - 1, Math.floor(state.elapsedSec)));
                const dragonX = secToX(curIdx);
                const dragonY = elevationToY(state.gradientProfile[curIdx].elevationMeters);
                drawTerrainDragonIcon(ctx, dragonX, dragonY, 0, scale);
            }

            ctx.fillStyle = '#94a3b8';
            ctx.font = `${Math.round(10 * scale)}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            const tickCount = 6;
            for (let i = 0; i <= tickCount; i++) {
                const tSec = Math.round((totalSec / tickCount) * i);
                ctx.fillText(formatDuration(tSec), secToX(tSec), originY + padTop + plotH + Math.round(5 * scale));
            }
            ctx.restore();
        }

        function drawWorkoutTimelineOnCanvas(canvas) {
            if (!canvas || !state.workout) return;
            const rect = canvas.getBoundingClientRect();
            if (rect.width < 20 || rect.height < 20) return;
            if (canvas.width !== Math.floor(rect.width) || canvas.height !== Math.floor(rect.height)) {
                canvas.width = Math.max(300, Math.floor(rect.width));
                canvas.height = Math.max(70, Math.floor(rect.height));
            }

            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            renderWorkoutTimelinePlot(ctx, 0, 0, canvas.width, canvas.height, 1);
        }

        function drawWorkoutTimeline() {
            drawWorkoutTimelineOnCanvas(document.getElementById('timelineCanvas'));
            drawWorkoutTimelineOnCanvas(document.getElementById('trainingPreviewCanvas'));
        }

