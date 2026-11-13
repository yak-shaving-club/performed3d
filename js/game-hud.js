        // =========================================================================
        // 9. LIVE HUD UPDATER & 1HZ WORKOUT TICK
        // =========================================================================
        function updateLiveHud() {
            if (!state.workout) return;
            updateGhostHud();
            const tolW = getAccuracyToleranceWatts();
            const targetWatts = getTargetWattsAtSecond(state.workout, state.elapsedSec, state.ftp);

            const summaryZoneEl = document.getElementById('summaryZoneLabel');
            if (summaryZoneEl) {
                summaryZoneEl.textContent = `Time in ±${tolW}W Gate Zone`;
            }

            const errorWatts = Math.abs(state.actualWatts - targetWatts);
            const inZone = state.actualWatts > 0 && errorWatts <= tolW;
            const isBullseye = state.actualWatts > 0 && errorWatts <= Math.max(2, tolW * 0.25);

            // Slope physics & timeline updates (UPWIND THERMAL / DOWNWIND DRAFT • Pedal More Watts to Gain Height)
            const gradSign = state.currentGradientPct > 0 ? '+' : '';
            const targetGradSign = state.targetGradientPct > 0 ? '+' : '';
            const formattedSlope = `${gradSign}${state.currentGradientPct.toFixed(1)}%`;
            const formattedTarget = state.resistanceMode === 'erg'
                ? `ERG Lock: ${targetWatts}W`
                : `Target Slope: ${targetGradSign}${state.targetGradientPct.toFixed(1)}%`;

            const currentGradEl = document.getElementById('currentGradientDisplay');
            if (currentGradEl) currentGradEl.textContent = formattedSlope;
            const targetGradEl = document.getElementById('targetGradientLabel');
            if (targetGradEl) targetGradEl.textContent = formattedTarget;

            const modeLabels = {
                easy: 'Easy (0% Flat)',
                medium: 'Medium (Downwind / Upwind)',
                realistic: 'Medium (Downwind / Upwind)',
                difficult: 'Difficult (Strong Downwind / Upwind)',
                erg: 'ERG Lock'
            };
            const shortModeLabels = {
                easy: 'Easy',
                medium: 'Medium',
                realistic: 'Medium',
                difficult: 'Difficult',
                erg: 'ERG Lock'
            };
            const gradModeTagEl = document.getElementById('gradientModeTag');
            if (gradModeTagEl) gradModeTagEl.textContent = modeLabels[state.resistanceMode] || 'Easy (0% Flat)';

            const tlTitleEl = document.getElementById('timelineWorkoutTitle');
            if (tlTitleEl && state.workout) tlTitleEl.textContent = state.workout.name;
            const tlModeEl = document.getElementById('timelineResistanceModeBadge');
            if (tlModeEl) tlModeEl.textContent = shortModeLabels[state.resistanceMode] || 'Easy';
            const tlValEl = document.getElementById('timelineResistanceValue');
            if (tlValEl) tlValEl.textContent = state.resistanceMode === 'erg' ? `${targetWatts}W` : formattedSlope;
            const tlTargetEl = document.getElementById('timelineResistanceTarget');
            if (tlTargetEl) tlTargetEl.textContent = formattedTarget;

            // Arena Glow
            const arenaCard = document.getElementById('hudArenaCard');
            if (arenaCard) {
                if (!state.isRunning) {
                    arenaCard.classList.remove('in-zone-glow', 'bullseye-glow');
                } else if (isBullseye) {
                    arenaCard.classList.add('bullseye-glow');
                    arenaCard.classList.remove('in-zone-glow');
                } else if (inZone) {
                    arenaCard.classList.add('in-zone-glow');
                    arenaCard.classList.remove('bullseye-glow');
                } else {
                    arenaCard.classList.remove('in-zone-glow', 'bullseye-glow');
                }
            }

            // Upper-Right Orange Game Points, Streak Duration, Currently Pedaled Watts, Heart Rate, Cadence & Speed
            const scoreEl = document.getElementById('totalScoreDisplay');
            if (scoreEl) {
                const formattedScore = formatSwissNumber(state.totalScore);
                if (scoreEl.textContent !== formattedScore) {
                    scoreEl.textContent = formattedScore;
                    scoreEl.classList.remove('hud-score-pop');
                    void scoreEl.offsetWidth;
                    scoreEl.classList.add('hud-score-pop');
                }
            }
            const streakEl = document.getElementById('streakSecondsText');
            if (streakEl) streakEl.textContent = `${formatSwissNumber(state.streakSeconds)}s`;
            const actualWattsEl = document.getElementById('actualWattsDisplay');
            if (actualWattsEl) actualWattsEl.textContent = formatSwissNumber(state.actualWatts);
            const heartRateEl = document.getElementById('heartRateDisplay');
            if (heartRateEl) {
                heartRateEl.textContent = (state.heartRate !== null && state.heartRate > 0)
                    ? formatSwissNumber(state.heartRate)
                    : '--';
            }
            const cadenceEl = document.getElementById('cadenceDisplay');
            if (cadenceEl) cadenceEl.textContent = formatSwissNumber(state.cadence);
            const speedEl = document.getElementById('speedDisplay');
            if (speedEl) speedEl.textContent = (Number(state.speedKmh) || 0).toFixed(1);

            updateFtpTestHudUI();
            updateExpectedWorkoutMetricsUI();
            drawWorkoutTimeline();
        }

        function computeBestOneMinuteAvgWatts(samples = state.samples) {
            if (!samples || samples.length === 0) return 0;
            const windowLen = Math.min(60, samples.length);
            let rollingSum = 0;
            let bestAvg = 0;
            for (let i = 0; i < samples.length; i++) {
                rollingSum += Math.max(0, Number(samples[i].actualWatts) || 0);
                if (i >= windowLen) {
                    rollingSum -= Math.max(0, Number(samples[i - windowLen].actualWatts) || 0);
                }
                if (i + 1 >= windowLen) {
                    const avg = rollingSum / windowLen;
                    if (avg > bestAvg) bestAvg = avg;
                }
            }
            return bestAvg;
        }

        function computeFtpFromSamples(samples = state.samples) {
            const bestOneMinWatts = computeBestOneMinuteAvgWatts(samples);
            const rawFtp = Math.round(bestOneMinWatts * 0.75);
            const clampedFtp = bestOneMinWatts > 0 ? Math.max(50, Math.min(600, rawFtp)) : state.ftp;
            return {
                bestOneMinWatts,
                calculatedFtp: clampedFtp
            };
        }

        function updateFtpTestHudUI() {
            const isFtpTest = Boolean(state.workout && state.workout.isFtpTest);
            const bannerEl = document.getElementById('ftpTestActiveBanner');
            const stopCountdownEl = document.getElementById('ftpTestStopCountdown');
            const hudRowEl = document.getElementById('ftpTestHudRow');

            if (bannerEl) {
                bannerEl.classList.toggle('hidden', !isFtpTest);
                bannerEl.classList.toggle('flex', isFtpTest);
            }
            if (hudRowEl) {
                hudRowEl.classList.toggle('hidden', !isFtpTest);
                hudRowEl.classList.toggle('flex', isFtpTest);
            }
            if (!isFtpTest) return;

            if (stopCountdownEl) {
                const showCountdown = state.isRunning && state.ftpTestPedalingStarted && state.ftpTestZeroPedalSeconds > 0;
                stopCountdownEl.classList.toggle('hidden', !showCountdown);
                if (showCountdown) {
                    const rem = Math.max(0, FTP_TEST_STOP_THRESHOLD_SECONDS - state.ftpTestZeroPedalSeconds);
                    stopCountdownEl.textContent = `Stopping in ${rem}s`;
                }
            }

            const { bestOneMinWatts, calculatedFtp } = computeFtpFromSamples(state.samples);
            const bestEl = document.getElementById('ftpTestBestMinWatts');
            const estEl = document.getElementById('ftpTestEstWatts');
            if (bestEl) bestEl.textContent = formatSwissNumber(Math.round(bestOneMinWatts));
            if (estEl) estEl.textContent = state.samples.length > 0 ? formatSwissNumber(calculatedFtp) : '--';
        }

        const DURATION_CATEGORIES = {
            short: { label: '≤15m Short', badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/35' },
            medium: { label: '16–30m Medium', badgeClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/35' },
            long: { label: '30m+ Long', badgeClass: 'bg-violet-500/15 text-violet-300 border-violet-500/35' }
        };

        const INTENSITY_CATEGORIES = {
            low: { label: 'Endurance (Z1–Z2)', shortLabel: 'Endurance', badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/35' },
            moderate: { label: 'Sweet Spot / Tempo', shortLabel: 'Sweet Spot', badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35' },
            threshold: { label: 'Threshold (Z4)', shortLabel: 'Threshold', badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/35' },
            high: { label: 'VO2max / HIIT', shortLabel: 'VO2max / HIIT', badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/35' },
            ftp_test: { label: 'FTP Ramp Test', shortLabel: 'FTP Test', badgeClass: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-400/50' }
        };

        function categorizeWorkout(workout, ftpInputVal = state.ftp) {
            if (!workout) {
                return {
                    durationKey: 'short',
                    durationMeta: DURATION_CATEGORIES.short,
                    intensityKey: 'moderate',
                    intensityMeta: INTENSITY_CATEGORIES.moderate,
                    intensityFactor: 0
                };
            }
            const totalSec = workout.totalDuration || 0;
            let durationKey = 'medium';
            if (totalSec <= 900) durationKey = 'short';
            else if (totalSec > 1800) durationKey = 'long';

            const { intensityFactor, peakWatts, ftp } = computeExpectedWorkoutMetrics(workout, ftpInputVal);
            const peakFrac = peakWatts / Math.max(50, ftp);

            let intensityKey = 'moderate';
            if (workout.isFtpTest) {
                intensityKey = 'ftp_test';
            } else if (intensityFactor < 0.76 && peakFrac < 0.85) {
                intensityKey = 'low';
            } else if (peakFrac >= 1.12 || intensityFactor >= 0.96) {
                intensityKey = 'high';
            } else if (intensityFactor >= 0.87 || peakFrac >= 0.98) {
                intensityKey = 'threshold';
            } else {
                intensityKey = 'moderate';
            }

            return {
                durationKey,
                durationMeta: DURATION_CATEGORIES[durationKey],
                intensityKey,
                intensityMeta: INTENSITY_CATEGORIES[intensityKey],
                intensityFactor
            };
        }

        function computeExpectedWorkoutMetrics(workout = state.workout, ftpInputVal = state.ftp) {
            if (!workout || !workout.totalDuration || workout.totalDuration <= 0) {
                return {
                    expectedAvgWatts: 0,
                    expectedTss: 0,
                    intensityFactor: 0,
                    peakWatts: 0,
                    ftp: Math.max(50, Number(ftpInputVal) || 200)
                };
            }

            const count = Math.max(1, Math.round(workout.totalDuration));
            const ftp = Math.max(50, Number(ftpInputVal) || 200);
            const targetWattsBySec = new Array(count);
            let sumWatts = 0;
            let peakWatts = 0;
            let sumFourthPower = 0;
            let rollingSum = 0;
            const windowSize = Math.min(30, count);

            for (let i = 0; i < count; i++) {
                const w = getTargetWattsAtSecond(workout, i, ftp);
                targetWattsBySec[i] = w;
                sumWatts += w;
                if (w > peakWatts) peakWatts = w;
                rollingSum += w;
                if (i >= windowSize) {
                    rollingSum -= targetWattsBySec[i - windowSize];
                }
                const currentWindowLen = Math.min(i + 1, windowSize);
                const rollingAvg = rollingSum / currentWindowLen;
                sumFourthPower += Math.pow(rollingAvg, 4);
            }

            const expectedAvgWatts = sumWatts / count;
            const normalizedPower = Math.pow(sumFourthPower / count, 0.25);
            const intensityFactor = normalizedPower / ftp;
            const expectedTss = ((count * normalizedPower * intensityFactor) / (ftp * 3600)) * 100;

            return {
                expectedAvgWatts,
                expectedTss,
                intensityFactor,
                peakWatts,
                ftp
            };
        }

        function updateExpectedWorkoutMetricsUI() {
            const avgEl = document.getElementById('expectedAvgWattsLabel');
            const ifEl = document.getElementById('expectedIfLabel');
            const tssEl = document.getElementById('expectedTssLabel');
            if (!avgEl && !tssEl && !ifEl) return;

            const { expectedAvgWatts, expectedTss, intensityFactor } = computeExpectedWorkoutMetrics(state.workout, state.ftp);
            if (avgEl) avgEl.textContent = `${Math.round(expectedAvgWatts)} W`;
            if (ifEl) ifEl.textContent = intensityFactor.toFixed(2);
            if (tssEl) tssEl.textContent = expectedTss.toFixed(1);

            const tagsContainer = document.getElementById('selectedWorkoutTags');
            if (tagsContainer && state.workout) {
                const cat = categorizeWorkout(state.workout, state.ftp);
                tagsContainer.innerHTML = '';
                const durBadge = document.createElement('span');
                durBadge.className = `px-2.5 py-1 rounded-xl border font-bold ${cat.durationMeta.badgeClass}`;
                durBadge.textContent = cat.durationMeta.label;
                const intBadge = document.createElement('span');
                intBadge.className = `px-2.5 py-1 rounded-xl border font-bold ${cat.intensityMeta.badgeClass}`;
                intBadge.textContent = cat.intensityMeta.label;
                tagsContainer.appendChild(durBadge);
                tagsContainer.appendChild(intBadge);
            }
        }

        function computeTrainingMetrics() {
            const count = state.samples.length;
            if (count === 0) {
                return {
                    durationSec: 0,
                    avgWatts: 0,
                    maxWatts: 0,
                    expectedAvgWatts: 0,
                    normalizedPower: 0,
                    intensityFactor: 0,
                    tss: 0,
                    totalWorkJoules: 0,
                    avgCadence: 0,
                    avgHeartRate: null,
                    maxHeartRate: null,
                    totalDistanceMeters: 0
                };
            }

            let sumWatts = 0;
            let sumTargetWatts = 0;
            let maxWatts = 0;
            let sumCadence = 0;
            let sumHeartRate = 0;
            let countHeartRate = 0;
            let maxHeartRate = 0;

            state.samples.forEach((s) => {
                sumWatts += s.actualWatts;
                sumTargetWatts += s.targetWatts;
                if (s.actualWatts > maxWatts) maxWatts = s.actualWatts;
                sumCadence += s.cadence;
                if (s.heartRate !== null && s.heartRate !== undefined && s.heartRate > 0) {
                    sumHeartRate += s.heartRate;
                    countHeartRate += 1;
                    if (s.heartRate > maxHeartRate) maxHeartRate = s.heartRate;
                }
            });

            const avgWatts = sumWatts / count;
            const expectedAvgWatts = sumTargetWatts / count;
            const avgCadence = sumCadence / count;
            const avgHeartRate = countHeartRate > 0 ? sumHeartRate / countHeartRate : null;
            const resolvedMaxHeartRate = countHeartRate > 0 ? maxHeartRate : null;

            let sumFourthPower = 0;
            let rollingSum = 0;
            const windowSize = Math.min(30, count);
            for (let i = 0; i < count; i++) {
                rollingSum += state.samples[i].actualWatts;
                if (i >= windowSize) {
                    rollingSum -= state.samples[i - windowSize].actualWatts;
                }
                const currentWindowLen = Math.min(i + 1, windowSize);
                const rollingAvg = rollingSum / currentWindowLen;
                sumFourthPower += Math.pow(rollingAvg, 4);
            }
            const normalizedPower = Math.pow(sumFourthPower / count, 0.25);
            const ftp = Math.max(50, state.ftp);
            const intensityFactor = normalizedPower / ftp;
            const tss = ((count * normalizedPower * intensityFactor) / (ftp * 3600)) * 100;

            return {
                durationSec: count,
                avgWatts,
                maxWatts,
                expectedAvgWatts,
                normalizedPower,
                intensityFactor,
                tss,
                totalWorkJoules: sumWatts,
                avgCadence,
                avgHeartRate,
                maxHeartRate: resolvedMaxHeartRate,
                totalDistanceMeters: state.totalDistanceMeters,
                ftp
            };
        }

        function executeWorkoutTick() {
            if (!state.isRunning || !state.workout) return;

            stepTerrainGradient();
            const targetWatts = getTargetWattsAtSecond(state.workout, state.elapsedSec, state.ftp);

            if ((bleTrainer.connected || bleRower.connected) && !state.simMode) {
                state.actualWatts = getThreeSecondAverageKickrWatts();
            }
            if (bleTrainer.connected) {
                if (state.resistanceMode === 'erg') {
                    bleTrainer.setErgTargetWatts(targetWatts);
                } else {
                    bleTrainer.setSimulationGrade(state.currentGradientPct);
                }
            }

            if (state.simMode) {
                const slider = document.getElementById('simWattSlider');
                if (state.simAutoJitter) {
                    state.actualWatts = Math.max(0, targetWatts);
                    slider.value = state.actualWatts;
                    document.getElementById('simWattReadout').textContent = `${state.actualWatts} W`;
                } else {
                    state.actualWatts = parseInt(slider.value, 10) || 0;
                }
                if (!bleCadenceSensor.connected) {
                    state.cadence = state.actualWatts > 0 ? Math.round(88 + (Math.random() - 0.5) * 6) : 0;
                }
                if (!bleSpeedSensor.connected) {
                    state.speedKmh = estimateSpeedMpsFromWatts(state.actualWatts) * 3.6;
                }
            }

            const isFtpTest = Boolean(state.workout && state.workout.isFtpTest);
            const hasDedicatedCadenceZero = !state.simMode && bleCadenceSensor.connected && state.cadence <= 0 && state.actualWatts < 20;
            const riderStoppedPedaling = state.actualWatts <= 0 || hasDedicatedCadenceZero;

            // Stop forward motion and workout progression when the user is not generating any watts
            if (riderStoppedPedaling) {
                if (!bleCadenceSensor.connected) state.cadence = 0;
                if (!bleSpeedSensor.connected) state.speedKmh = 0;
                state.streakSeconds = 0;
                state.comboMultiplier = 1.0;
                state.lastPointsAwarded = 0;

                if (isFtpTest && state.ftpTestPedalingStarted) {
                    state.ftpTestZeroPedalSeconds += 1;
                    updateLiveHud();
                    if (state.ftpTestZeroPedalSeconds >= FTP_TEST_STOP_THRESHOLD_SECONDS) {
                        state.ftpTestAutoStopped = true;
                        prepareWorkoutScreenshot();
                        finishWorkoutAndShowSummary();
                    }
                    return;
                }

                updateLiveHud();
                return;
            }

            if (isFtpTest) {
                state.ftpTestPedalingStarted = true;
                state.ftpTestZeroPedalSeconds = 0;
            }

            const speedMps = state.speedKmh / 3.6;
            state.totalDistanceMeters += speedMps;

            const prevCombo = state.comboMultiplier;
            const tolW = getAccuracyToleranceWatts();
            const gateY = wattsToSkyAltitudeY(targetWatts, state.ftp, state.currentGradientPct);
            const donutRadius = getDonutRadiusForTargetWatts(targetWatts, state.ftp, state.currentGradientPct, tolW);
            const dragonAltitudeDiff = dragon3D ? Math.abs(dragon3D.dragonCurrentY - gateY) : Infinity;
            const dragonHorizontalDiff = state.steeringEnabled
                ? (dragon3D ? Math.abs(dragon3D.dragonSteerOffsetX) : Math.abs(state.dragonSteerOffsetX || 0))
                : 0;
            const radialDistFromGateCenter = Math.hypot(dragonHorizontalDiff, dragonAltitudeDiff);
            const missedGateLeftOrRight = state.steeringEnabled && dragonHorizontalDiff > donutRadius;
            const clearedGateThisSec = Boolean(dragon3D && dragon3D.lastClearedGateWorkoutSec === state.elapsedSec);
            const withinWattTolerance = state.actualWatts > 0 && Math.abs(state.actualWatts - targetWatts) <= tolW;
            const flewThroughDonut = withinWattTolerance && !missedGateLeftOrRight && (clearedGateThisSec || (dragonAltitudeDiff <= donutRadius && radialDistFromGateCenter <= donutRadius));
            const evalRes = evaluateAccuracyTick(
                state.actualWatts,
                targetWatts,
                state.streakSeconds,
                flewThroughDonut,
                dragonAltitudeDiff,
                donutRadius,
                tolW
            );

            if (evalRes.inZone) {
                state.streakSeconds += 1;
                if (state.streakSeconds > state.maxStreakSeconds) {
                    state.maxStreakSeconds = state.streakSeconds;
                }
                state.inZoneSeconds += 1;
                state.comboMultiplier = evalRes.combo;
                state.lastPointsAwarded = evalRes.points;
                state.totalScore += evalRes.points;

                const arenaRect = document.getElementById('hudArenaCard').getBoundingClientRect();
                const burstX = arenaRect.left + arenaRect.width * 0.5 + (Math.random() - 0.5) * 120;
                const burstY = arenaRect.top + arenaRect.height * 0.45;
                fxEngine.spawnAccuracyBurst(burstX, burstY, evalRes.accuracyFactor, evalRes.isBullseye);
                spawnFloatingScorePopup(evalRes.points, evalRes.isBullseye, evalRes.ratioPct);

                // One ring spawns per workout second, so the in-zone streak equals consecutive rings cleared
                if (state.streakSeconds % RING_STREAK_MILESTONE === 0) {
                    const tier = state.streakSeconds / RING_STREAK_MILESTONE;
                    const bonusPts = RING_STREAK_BONUS_PER_TIER * tier;
                    state.totalScore += bonusPts;
                    spawnRingStreakSplash(state.streakSeconds, tier, bonusPts);
                    fxEngine.spawnAccuracyBurst(arenaRect.left + arenaRect.width * 0.5, arenaRect.top + arenaRect.height * 0.3, 1, true);
                    soundEngine.playRingStreakBonus(tier);
                } else if (state.comboMultiplier > prevCombo) {
                    soundEngine.playComboUp();
                } else {
                    soundEngine.playPointTick(evalRes.accuracyFactor, state.comboMultiplier);
                }
            } else {
                state.streakSeconds = 0;
                state.comboMultiplier = 1.0;
                state.lastPointsAwarded = 0;
            }

            state.samples.push({
                timestampMs: Date.now(),
                elapsedSec: state.elapsedSec,
                targetWatts,
                actualWatts: state.actualWatts,
                heartRate: state.heartRate,
                cadence: state.cadence,
                speedMps,
                distanceMeters: state.totalDistanceMeters,
                gradientPct: state.currentGradientPct,
                inZone: evalRes.inZone,
                isBullseye: evalRes.isBullseye,
                points: evalRes.points,
                totalScore: state.totalScore
            });

            state.elapsedSec += 1;

            if (state.elapsedSec < state.workout.totalDuration) {
                syncGradientAtSecond(state.elapsedSec);
                const nextTargetWatts = getTargetWattsAtSecond(state.workout, state.elapsedSec, state.ftp);
                if (bleTrainer.connected) {
                    if (state.resistanceMode === 'erg') {
                        bleTrainer.setErgTargetWatts(nextTargetWatts);
                    } else {
                        bleTrainer.setSimulationGrade(state.currentGradientPct);
                    }
                }
                if (state.simMode && state.simAutoJitter) {
                    const slider = document.getElementById('simWattSlider');
                    state.actualWatts = Math.max(0, nextTargetWatts);
                    slider.value = state.actualWatts;
                    document.getElementById('simWattReadout').textContent = `${state.actualWatts} W`;
                }
            }

            updateLiveHud();

            if (state.elapsedSec >= state.workout.totalDuration) {
                prepareWorkoutScreenshot();
                finishWorkoutAndShowSummary();
            }
        }

        function syncActionButtonsUI() {
            const startBtnText = document.getElementById('startBtnText');
            const startWorkoutBtn = document.getElementById('startWorkoutBtn');
            const compactPauseResumeText = document.getElementById('compactPauseResumeText');
            const compactPauseResumeBtn = document.getElementById('compactPauseResumeBtn');

            if (state.isRunning) {
                if (startBtnText) startBtnText.textContent = 'Pause Flight';
                if (startWorkoutBtn) {
                    startWorkoutBtn.className =
                        'px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-gray-950 font-black text-xs tracking-wide uppercase flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer shadow-lg shadow-amber-500/25 transition';
                }
                if (compactPauseResumeText) compactPauseResumeText.textContent = 'Pause Flight';
                if (compactPauseResumeBtn) {
                    compactPauseResumeBtn.className =
                        'px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-gray-950 font-black text-xs uppercase tracking-wide flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer shadow transition';
                }
            } else {
                const label = state.hasStartedSession ? 'Resume Flight' : 'Start Flight';
                if (startBtnText) startBtnText.textContent = label;
                if (startWorkoutBtn) {
                    startWorkoutBtn.className =
                        'px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-400 hover:from-emerald-400 hover:to-green-300 text-gray-950 font-black text-xs tracking-wide uppercase flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer shadow-lg shadow-emerald-500/25 transition';
                }
                if (compactPauseResumeText) compactPauseResumeText.textContent = label;
                if (compactPauseResumeBtn) {
                    compactPauseResumeBtn.className =
                        'px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-400 hover:from-emerald-400 hover:to-green-300 text-gray-950 font-black text-xs uppercase tracking-wide flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer shadow transition';
                }
            }

            const finishBtn = document.getElementById('finishWorkoutBtn');
            if (finishBtn) finishBtn.disabled = !state.hasStartedSession;
            const accSliderEl = document.getElementById('accuracyToleranceSlider');
            const accInputEl = document.getElementById('accuracyToleranceInput');
            if (accSliderEl) accSliderEl.disabled = state.hasStartedSession;
            if (accInputEl) accInputEl.disabled = state.hasStartedSession;
            updateHeaderAndSetupVisibility();
        }

        let dragon3D = null;

        function startOrPauseWorkout() {
            if (!state.workout) return;

            if (!state.isRunning) {
                if (state.currentScreen !== 'game') {
                    setScreen('game');
                }
                if (state.elapsedSec >= state.workout.totalDuration) {
                    resetWorkoutSession();
                }
                if (!state.startTimeMs) {
                    state.startTimeMs = Date.now();
                }
                state.hasStartedSession = true;
                state.forceShowSetupDuringTraining = false;
                state.isRunning = true;
            } else {
                state.isRunning = false;
            }
            syncActionButtonsUI();
            updateLiveHud();
        }

        function resetWorkoutSession() {
            state.isRunning = false;
            state.hasStartedSession = false;
            state.forceShowSetupDuringTraining = false;
            state.elapsedSec = 0;
            state.startTimeMs = null;
            if (state.workout) {
                state.gradientProfile = generateTerrainGradientProfile(state.workout.totalDuration, state.resistanceMode);
            }
            regenerateRandomCanyonPath();
            syncGradientAtSecond(0);
            state.totalDistanceMeters = 0;
            state.totalScore = 0;
            state.lastPointsAwarded = 0;
            state.streakSeconds = 0;
            state.maxStreakSeconds = 0;
            state.comboMultiplier = 1.0;
            state.inZoneSeconds = 0;
            state.gatesPassedCount = 0;
            state.obstaclesDestroyedCount = 0;
            state.obstacleHitsCount = 0;
            state.arrowHitsCount = 0;
            state.steerLeftPressed = false;
            state.steerRightPressed = false;
            state.dragonSteerOffsetX = 0;
            state.dragonHeadingAngle = 0;
            state.dragonWorldX = getSimulatedTurnOffsetX(0);
            state.samples = [];
            state.ftpTestPedalingStarted = false;
            state.ftpTestZeroPedalSeconds = 0;
            state.ftpTestAutoStopped = false;
            state.preparedScreenshotDataUrl = null;
            state.preparedScreenshotTimestamp = null;
            updateScreenshotButtonsUI(false);

            if (dragon3D) {
                dragon3D.seedInitialGatesAndObstacles();
            }

            syncActionButtonsUI();
            updateLiveHud();
        }

        function finishWorkoutAndShowSummary() {
            const wasAutoStoppedFtpTest = state.ftpTestAutoStopped;
            state.isRunning = false;
            state.hasStartedSession = false;
            state.forceShowSetupDuringTraining = false;
            state.ftpTestZeroPedalSeconds = 0;
            state.ftpTestAutoStopped = false;
            syncActionButtonsUI();

            if (state.samples.length === 0) {
                const targetWatts = getTargetWattsAtSecond(state.workout, 0, state.ftp);
                state.samples.push({
                    timestampMs: Date.now(),
                    elapsedSec: 0,
                    targetWatts,
                    actualWatts: state.actualWatts || targetWatts,
                    heartRate: state.heartRate,
                    cadence: state.cadence || 85,
                    speedMps: estimateSpeedMpsFromWatts(state.actualWatts || targetWatts),
                    distanceMeters: 10,
                    inZone: true,
                    isBullseye: false,
                    points: 50
                });
            }

            const previousFtp = state.ftp;
            const metrics = computeTrainingMetrics();
            const isFtpTest = Boolean(state.workout && state.workout.isFtpTest);
            let calculatedFtpResult = null;

            if (isFtpTest) {
                const { bestOneMinWatts, calculatedFtp } = computeFtpFromSamples(state.samples);
                calculatedFtpResult = {
                    bestOneMinWatts,
                    calculatedFtp,
                    previousFtp
                };
                if (bestOneMinWatts > 0 && calculatedFtp >= 50 && calculatedFtp <= 600) {
                    const ftpInputEl = document.getElementById('ftpInput');
                    if (ftpInputEl) ftpInputEl.value = calculatedFtp;
                    applyFtpWatts(calculatedFtp);
                }
            }

            const inZonePct = (state.inZoneSeconds / Math.max(1, state.samples.length)) * 100;
            const wattMatchPct = metrics.expectedAvgWatts > 0
                ? (metrics.avgWatts / metrics.expectedAvgWatts) * 100
                : 100;

            let rank = 'C';
            if (inZonePct >= 90) rank = 'S+';
            else if (inZonePct >= 80) rank = 'S';
            else if (inZonePct >= 65) rank = 'A';
            else if (inZonePct >= 50) rank = 'B';

            state.lastSummary = {
                ...metrics,
                ftp: isFtpTest && calculatedFtpResult ? calculatedFtpResult.calculatedFtp : metrics.ftp,
                calculatedFtp: calculatedFtpResult ? calculatedFtpResult.calculatedFtp : null,
                bestOneMinWatts: calculatedFtpResult ? calculatedFtpResult.bestOneMinWatts : null,
                startTimeMs: state.startTimeMs || (Date.now() - metrics.durationSec * 1000),
                endTimeMs: Date.now(),
                workoutName: state.workout.name
            };

            const summaryHeaderBadgeEl = document.getElementById('summaryHeaderBadge');
            const summarySubtitleEl = document.getElementById('summarySubtitle');
            const ftpCardEl = document.getElementById('summaryFtpTestCard');

            if (isFtpTest && calculatedFtpResult) {
                if (summaryHeaderBadgeEl) {
                    summaryHeaderBadgeEl.textContent = 'FTP RAMP TEST COMPLETED';
                    summaryHeaderBadgeEl.className = 'text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-fuchsia-500/25 text-fuchsia-200 border border-fuchsia-400/40';
                }
                if (summarySubtitleEl) {
                    summarySubtitleEl.textContent = wasAutoStoppedFtpTest
                        ? `Auto-stopped after ${FTP_TEST_STOP_THRESHOLD_SECONDS}s without pedaling — your new FTP is saved for future trainings.`
                        : 'FTP Ramp Test finished — your newly calculated FTP has been saved for future trainings.';
                }
                if (ftpCardEl) {
                    ftpCardEl.classList.remove('hidden');
                    const bestMinEl = document.getElementById('summaryBestOneMinWatts');
                    const calcFtpEl = document.getElementById('summaryCalculatedFtp');
                    const deltaEl = document.getElementById('summaryFtpDeltaLabel');
                    if (bestMinEl) bestMinEl.textContent = Math.round(calculatedFtpResult.bestOneMinWatts);
                    if (calcFtpEl) calcFtpEl.textContent = calculatedFtpResult.calculatedFtp;
                    if (deltaEl) {
                        const diff = calculatedFtpResult.calculatedFtp - calculatedFtpResult.previousFtp;
                        const diffSign = diff > 0 ? '+' : '';
                        deltaEl.textContent = diff === 0
                            ? `Unchanged (${calculatedFtpResult.previousFtp} W)`
                            : `Prev ${calculatedFtpResult.previousFtp} W (${diffSign}${diff} W)`;
                        deltaEl.className = diff > 0
                            ? 'px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-[11px] font-mono font-bold text-emerald-300'
                            : 'px-2 py-0.5 rounded-full bg-gray-900/90 border border-gray-700 text-[11px] font-mono font-bold text-gray-300';
                    }
                }
            } else {
                if (summaryHeaderBadgeEl) {
                    summaryHeaderBadgeEl.textContent = 'DRAGON FLIGHT COMPLETED';
                    summaryHeaderBadgeEl.className = 'text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
                }
                if (summarySubtitleEl) {
                    summarySubtitleEl.textContent = 'Awesome flight! Here is your complete 3D gate accuracy, obstacle defense & power breakdown.';
                }
                if (ftpCardEl) {
                    ftpCardEl.classList.add('hidden');
                }
            }

            document.getElementById('summaryWorkoutTitle').textContent = state.workout.name;
            document.getElementById('summaryRankBadge').textContent = rank;
            document.getElementById('summaryTotalScore').textContent = formatSwissNumber(state.totalScore);
            document.getElementById('summaryMaxStreak').textContent = `Streak ${formatSwissNumber(state.maxStreakSeconds)}s • ${state.gatesPassedCount} Gates • ${state.obstaclesDestroyedCount} Blasted`;
            document.getElementById('summaryTimeInZone').textContent = `${inZonePct.toFixed(1)}%`;
            document.getElementById('summaryTimeInZoneSec').textContent = `${state.inZoneSeconds}s of ${metrics.durationSec}s`;
            document.getElementById('summaryWattMatchPct').textContent = `${wattMatchPct.toFixed(1)}%`;
            document.getElementById('summaryExpectedWatts').textContent = `Target Avg: ${Math.round(metrics.expectedAvgWatts)} W`;

            document.getElementById('summaryAvgWatts').textContent = Math.round(metrics.avgWatts);
            document.getElementById('summaryMaxWatts').textContent = Math.round(metrics.maxWatts);
            document.getElementById('summaryDuration').textContent = formatDuration(metrics.durationSec);
            document.getElementById('summaryDistance').textContent = (metrics.totalDistanceMeters / 1000).toFixed(2);
            document.getElementById('summaryTss').textContent = metrics.tss.toFixed(1);
            document.getElementById('summaryFtpUsed').textContent = previousFtp;
            document.getElementById('summaryNp').textContent = Math.round(metrics.normalizedPower);
            document.getElementById('summaryIf').textContent = metrics.intensityFactor.toFixed(2);
            document.getElementById('summaryWorkKj').textContent = (metrics.totalWorkJoules / 1000).toFixed(1);
            document.getElementById('summaryAvgCadence').textContent = Math.round(metrics.avgCadence);

            const ghostResultEl = document.getElementById('summaryGhostResult');
            ghostResultEl.textContent = getGhostRaceResultText();
            ghostResultEl.classList.toggle('hidden', !state.ghost);

            syncSummaryScreenshotDialogUI();
            setScreen('summary');

            soundEngine.playFinishFanfare();
            fxEngine.spawnAccuracyBurst(window.innerWidth * 0.35, window.innerHeight * 0.35, 1, true);
            fxEngine.spawnAccuracyBurst(window.innerWidth * 0.65, window.innerHeight * 0.35, 1, true);
        }

        let parsedPresetsCache = null;
        function getParsedPresets() {
            if (!parsedPresetsCache) {
                parsedPresetsCache = Object.entries(PRESET_WORKOUTS).map(([key, xml]) => ({
                    key,
                    workout: parseZwiftWorkoutXml(xml)
                }));
            }
            return parsedPresetsCache;
        }

        function syncWorkoutFilterButtonsUI() {
            document.querySelectorAll('[data-duration-filter]').forEach((btn) => {
                const active = btn.getAttribute('data-duration-filter') === state.durationFilter;
                btn.className = active
                    ? 'px-2 py-0.5 rounded-lg text-[11px] font-black bg-amber-500/20 text-amber-300 border border-amber-400/50 cursor-pointer transition'
                    : 'px-2 py-0.5 rounded-lg text-[11px] font-semibold text-gray-400 hover:text-gray-200 hover:bg-gray-800 border border-transparent cursor-pointer transition';
            });
            document.querySelectorAll('[data-intensity-filter]').forEach((btn) => {
                const filterVal = btn.getAttribute('data-intensity-filter');
                const active = filterVal === state.intensityFilter;
                const activeStyle = filterVal === 'ftp_test'
                    ? 'px-2 py-0.5 rounded-lg text-[11px] font-black bg-fuchsia-500/25 text-fuchsia-200 border border-fuchsia-400/60 cursor-pointer transition'
                    : 'px-2 py-0.5 rounded-lg text-[11px] font-black bg-amber-500/20 text-amber-300 border border-amber-400/50 cursor-pointer transition';
                btn.className = active
                    ? activeStyle
                    : 'px-2 py-0.5 rounded-lg text-[11px] font-semibold text-gray-400 hover:text-gray-200 hover:bg-gray-800 border border-transparent cursor-pointer transition';
            });
        }

        function renderPresetWorkoutCards() {
            const grid = document.getElementById('presetCardsGrid');
            if (!grid) return;
            syncWorkoutFilterButtonsUI();
            const presets = getParsedPresets();
            const filtered = presets.filter(({ workout }) => {
                const cat = categorizeWorkout(workout, state.ftp);
                const matchesDuration = state.durationFilter === 'all' || cat.durationKey === state.durationFilter;
                const matchesIntensity = state.intensityFilter === 'all' || cat.intensityKey === state.intensityFilter;
                return matchesDuration && matchesIntensity;
            });

            const countBadge = document.getElementById('presetCountBadge');
            if (countBadge) {
                countBadge.textContent = filtered.length === presets.length
                    ? `${presets.length}`
                    : `${filtered.length} / ${presets.length}`;
            }

            grid.innerHTML = '';
            if (filtered.length === 0) {
                const emptyDiv = document.createElement('div');
                emptyDiv.className = 'col-span-full rounded-2xl border border-gray-800 bg-gray-900/60 p-5 text-center text-xs text-gray-400 flex flex-col items-center gap-2';
                const msgSpan = document.createElement('span');
                msgSpan.textContent = 'No built-in workouts match the selected duration and intensity filters.';
                const resetBtn = document.createElement('button');
                resetBtn.type = 'button';
                resetBtn.className = 'px-3 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-amber-300 font-bold border border-gray-700 cursor-pointer transition';
                resetBtn.textContent = 'Show All Workouts';
                resetBtn.addEventListener('click', () => {
                    state.durationFilter = 'all';
                    state.intensityFilter = 'all';
                    renderPresetWorkoutCards();
                });
                emptyDiv.appendChild(msgSpan);
                emptyDiv.appendChild(resetBtn);
                grid.appendChild(emptyDiv);
                return;
            }

            filtered.forEach(({ key, workout }) => {
                const { expectedAvgWatts, expectedTss, intensityFactor } = computeExpectedWorkoutMetrics(workout, state.ftp);
                const cat = categorizeWorkout(workout, state.ftp);
                const isSelected = state.selectedPresetKey === key;
                const selectedBorder = workout.isFtpTest
                    ? 'bg-fuchsia-500/15 border-fuchsia-400/70 shadow-md shadow-fuchsia-500/15'
                    : 'bg-amber-500/15 border-amber-400/60 shadow-md shadow-amber-500/10';
                const card = document.createElement('button');
                card.type = 'button';
                card.setAttribute('data-preset-card', key);
                card.className = isSelected
                    ? `text-left rounded-2xl p-3 border transition cursor-pointer ${selectedBorder} flex flex-col justify-between gap-1.5`
                    : 'text-left rounded-2xl p-3 border transition cursor-pointer bg-gray-900/80 hover:bg-gray-800/90 border-gray-800 hover:border-gray-700 flex flex-col justify-between gap-1.5';

                const topRow = document.createElement('div');
                topRow.className = 'flex items-start justify-between gap-2';
                const titleSpan = document.createElement('span');
                titleSpan.className = isSelected
                    ? (workout.isFtpTest ? 'text-xs font-black text-fuchsia-200 leading-snug' : 'text-xs font-black text-amber-300 leading-snug')
                    : 'text-xs font-bold text-gray-100 leading-snug';
                titleSpan.textContent = workout.name;
                const durSpan = document.createElement('span');
                durSpan.className = 'px-1.5 py-0.5 rounded bg-gray-950 border border-gray-800 text-[10px] font-mono font-bold text-emerald-300 shrink-0 whitespace-nowrap';
                durSpan.textContent = formatDuration(workout.totalDuration);
                topRow.appendChild(titleSpan);
                topRow.appendChild(durSpan);

                const descP = document.createElement('p');
                descP.className = 'text-[11px] text-gray-400 line-clamp-2 leading-snug';
                descP.textContent = workout.description || '';

                const footerDiv = document.createElement('div');
                footerDiv.className = 'flex items-center justify-between gap-1.5 text-[10px] font-mono text-gray-300 pt-1 border-t border-gray-800/80';
                const metricsSpan = document.createElement('span');
                metricsSpan.className = 'truncate';
                metricsSpan.textContent = workout.isFtpTest
                    ? `Ramp to Exhaustion • Est ≤${formatDuration(workout.totalDuration)}`
                    : `Avg ${Math.round(expectedAvgWatts)}W • IF ${intensityFactor.toFixed(2)} • TSS ${expectedTss.toFixed(0)}`;
                const catBadge = document.createElement('span');
                catBadge.className = `px-1.5 py-0.5 rounded border text-[9px] font-sans font-bold shrink-0 ${cat.intensityMeta.badgeClass}`;
                catBadge.textContent = cat.intensityMeta.shortLabel;
                footerDiv.appendChild(metricsSpan);
                footerDiv.appendChild(catBadge);

                card.appendChild(topRow);
                card.appendChild(descP);
                card.appendChild(footerDiv);

                card.addEventListener('click', () => {
                    loadWorkoutFromXml(PRESET_WORKOUTS[key], key);
                });
                grid.appendChild(card);
            });
        }

        function loadWorkoutFromXml(xmlString, presetKey = null) {
            const parsed = parseZwiftWorkoutXml(xmlString);
            state.workout = parsed;
            state.selectedPresetKey = presetKey;
            state.workoutXml = xmlString;
            if (state.ghost && state.ghost.workoutXml !== xmlString) {
                clearGhostRide();
            }
            const titleEl = document.getElementById('workoutTitleLabel');
            if (titleEl) titleEl.textContent = parsed.name;
            const tlTitleEl = document.getElementById('timelineWorkoutTitle');
            if (tlTitleEl) tlTitleEl.textContent = parsed.name;
            const descEl = document.getElementById('workoutDescriptionLabel');
            if (descEl) descEl.textContent = parsed.description || 'Structured target-watt flight through 3D Sky Donut Gates.';
            const durEl = document.getElementById('workoutDurationLabel');
            if (durEl) durEl.textContent = formatDuration(parsed.totalDuration);
            const ftpHintEl = document.getElementById('workoutFtpTestHint');
            if (ftpHintEl) ftpHintEl.classList.toggle('hidden', !parsed.isFtpTest);
            const zwoBadge = document.getElementById('customZwoBadge');
            if (zwoBadge) zwoBadge.classList.toggle('hidden', Boolean(presetKey));
            renderPresetWorkoutCards();
            resetWorkoutSession();
        }

        // =========================================================================
        // GHOST RIDES: save a finished ride and race against it later
        // =========================================================================
        const GHOST_FILE_FORMAT = 'loop-kicker-journey-ghost';
        const LEGACY_GHOST_FILE_FORMAT = 'performed3d-ghost';
        const GHOST_FILE_VERSION = 1;
        const GHOST_MAX_SECONDS = 6 * 3600;

        function buildGhostRideFile() {
            return {
                format: GHOST_FILE_FORMAT,
                version: GHOST_FILE_VERSION,
                recordedAt: new Date(state.lastSummary.startTimeMs || Date.now()).toISOString(),
                workoutName: state.workout.name,
                workoutXml: state.workoutXml,
                ftp: state.ftp,
                avatarType: state.avatarType,
                finalScore: Math.round(state.totalScore),
                distanceMeters: Math.round(state.totalDistanceMeters),
                // Per recorded second: [workoutSecond, watts, cumulativeDistanceMeters, cumulativeScore]
                samples: state.samples.map((s) => [
                    s.elapsedSec,
                    Math.round(s.actualWatts),
                    Math.round((s.distanceMeters || 0) * 10) / 10,
                    Math.round(s.totalScore || 0)
                ])
            };
        }

        function parseGhostRideFile(text) {
            let data;
            try {
                data = JSON.parse(text);
            } catch (err) {
                throw new Error('The file is not valid JSON.');
            }
            if (!data || ![GHOST_FILE_FORMAT, LEGACY_GHOST_FILE_FORMAT].includes(data.format) || data.version !== GHOST_FILE_VERSION) {
                throw new Error('This is not a Loop Kicker Journey ghost ride file.');
            }
            if (typeof data.workoutXml !== 'string' || !data.workoutXml.trim()) {
                throw new Error('The ghost ride does not contain its workout.');
            }
            if (!Array.isArray(data.samples) || data.samples.length > GHOST_MAX_SECONDS) {
                throw new Error('The ghost ride has no valid samples.');
            }
            const rows = data.samples
                .filter((row) => Array.isArray(row) && row.length >= 4 && row.slice(0, 4).every(Number.isFinite)
                    && Number.isInteger(row[0]) && row[0] >= 0 && row[0] < GHOST_MAX_SECONDS)
                .sort((a, b) => a[0] - b[0]);
            if (rows.length === 0) {
                throw new Error('The ghost ride has no valid samples.');
            }

            const lastSec = rows[rows.length - 1][0];
            const watts = new Float32Array(lastSec + 1);
            const distance = new Float32Array(lastSec + 1);
            const score = new Float32Array(lastSec + 1);
            let rowIdx = 0;
            let current = [0, 0, 0, 0];
            for (let sec = 0; sec <= lastSec; sec++) {
                let hasSample = false;
                while (rowIdx < rows.length && rows[rowIdx][0] === sec) {
                    current = rows[rowIdx];
                    rowIdx += 1;
                    hasSample = true;
                }
                // Seconds without a sample (paused or skipped) carry distance/score forward at zero watts
                watts[sec] = hasSample ? Math.max(0, current[1]) : 0;
                distance[sec] = Math.max(0, current[2]);
                score[sec] = current[3];
            }

            return {
                name: String(data.workoutName || 'Ghost Ride').slice(0, 80),
                recordedAt: typeof data.recordedAt === 'string' ? data.recordedAt : null,
                workoutXml: data.workoutXml,
                watts,
                distance,
                score,
                lastSec,
                finalScore: score[lastSec],
                finalDistance: distance[lastSec]
            };
        }

        // Ghost totals after the given workout second has been completed
        function getGhostRideTotalsAfterSecond(sec) {
            const ghost = state.ghost;
            if (!ghost || sec < 0) return { distance: 0, score: 0, finished: false };
            const idx = Math.min(sec, ghost.lastSec);
            return { distance: ghost.distance[idx], score: ghost.score[idx], finished: sec >= ghost.lastSec };
        }

        function getGhostRideWattsAtSecond(sec) {
            const ghost = state.ghost;
            if (!ghost || sec < 0 || sec > ghost.lastSec) return 0;
            return ghost.watts[sec];
        }

        function formatSignedGhostValue(value, unit) {
            const rounded = Math.round(value);
            const sign = rounded > 0 ? '+' : (rounded < 0 ? '−' : '±');
            return `${sign}${formatSwissNumber(Math.abs(rounded))} ${unit}`;
        }

        function updateGhostUI() {
            const chip = document.getElementById('ghostStatusChip');
            const label = document.getElementById('ghostStatusLabel');
            const hudRow = document.getElementById('ghostHudRow');
            const hasGhost = Boolean(state.ghost);
            chip.classList.toggle('hidden', !hasGhost);
            chip.classList.toggle('flex', hasGhost);
            hudRow.classList.toggle('hidden', !hasGhost);
            hudRow.classList.toggle('flex', hasGhost);
            if (hasGhost) {
                const recorded = state.ghost.recordedAt ? new Date(state.ghost.recordedAt) : null;
                const dateText = recorded && !isNaN(recorded) ? ` · ${recorded.toLocaleDateString()}` : '';
                label.textContent = `Ghost: ${formatSwissNumber(state.ghost.finalScore)} pts${dateText}`;
                chip.title = `Racing against a ghost ride of "${state.ghost.name}"${dateText}`;
            }
            updateAvatarReadySummaryUI();
            updateGhostHud();
        }

        function updateGhostHud() {
            if (!state.ghost) return;
            const totals = getGhostRideTotalsAfterSecond(state.elapsedSec - 1);
            const gapMeters = state.totalDistanceMeters - totals.distance;
            const scoreDelta = state.totalScore - totals.score;
            const gapEl = document.getElementById('ghostGapDisplay');
            const scoreEl = document.getElementById('ghostScoreDeltaDisplay');
            gapEl.textContent = formatSignedGhostValue(gapMeters, 'm');
            gapEl.className = `text-xs sm:text-sm font-black tabular-nums ${gapMeters >= 0 ? 'text-emerald-300' : 'text-rose-300'}`;
            scoreEl.textContent = formatSignedGhostValue(scoreDelta, 'pts');
            scoreEl.className = `text-[10px] sm:text-xs font-black tabular-nums ${scoreDelta >= 0 ? 'text-emerald-300' : 'text-rose-300'}`;
            document.getElementById('ghostWattsDisplay').textContent = Math.round(getGhostRideWattsAtSecond(state.elapsedSec));
        }

        function getGhostRaceResultText() {
            if (!state.ghost) return '';
            const totals = getGhostRideTotalsAfterSecond(state.elapsedSec - 1);
            const scoreDelta = Math.round(state.totalScore - totals.score);
            const gapMeters = Math.round(state.totalDistanceMeters - totals.distance);
            const gapText = `${formatSignedGhostValue(gapMeters, 'm')} distance`;
            if (scoreDelta > 0) return `Ghost race: you beat the ghost by ${formatSwissNumber(scoreDelta)} pts (${gapText}).`;
            if (scoreDelta < 0) return `Ghost race: the ghost won by ${formatSwissNumber(-scoreDelta)} pts (${gapText}).`;
            return `Ghost race: tied with the ghost (${gapText}).`;
        }

        function setGhostRide(ghost) {
            state.ghost = ghost;
            if (dragon3D) dragon3D.rebuildGhostModel();
            updateGhostUI();
            updateLiveHud();
        }

        function clearGhostRide() {
            setGhostRide(null);
        }

        function selectPresetMatchingXml(xmlString) {
            return Object.keys(PRESET_WORKOUTS).find((key) => PRESET_WORKOUTS[key] === xmlString) || null;
        }

        function loadGhostRideFromText(text) {
            const ghost = parseGhostRideFile(text);
            const presetKey = selectPresetMatchingXml(ghost.workoutXml);
            loadWorkoutFromXml(ghost.workoutXml, presetKey);
            setGhostRide(ghost);
        }

        function downloadGhostRide() {
            if (!state.lastSummary || !state.workoutXml || state.samples.length === 0) return;
            const json = JSON.stringify(buildGhostRideFile());
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const safeName = (state.lastSummary.workoutName || 'loop_kicker_journey_ride')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '_');
            const dateStr = new Date().toISOString().slice(0, 10);
            a.href = url;
            a.download = `${safeName}_${dateStr}.loop-kicker-journey-ghost.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
        }

        function toggleSimMode(forceState) {
            state.simMode = typeof forceState === 'boolean' ? forceState : !state.simMode;
            const bar = document.getElementById('simControlBar');
            const text = document.getElementById('simToggleText');
            const btn = document.getElementById('simToggleBtn');
            if (state.simMode) {
                bar.classList.remove('hidden');
                text.textContent = 'Sim Mode: ON';
                btn.className = 'px-2.5 py-2 rounded-xl font-semibold text-xs flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 transition cursor-pointer';
                if (state.simAutoJitter && state.workout) {
                    const targetW = getTargetWattsAtSecond(state.workout, state.elapsedSec, state.ftp);
                    state.actualWatts = targetW;
                } else {
                    const sliderVal = parseInt(document.getElementById('simWattSlider').value, 10);
                    state.actualWatts = !isNaN(sliderVal) ? Math.max(0, sliderVal) : 0;
                }
                document.getElementById('simWattSlider').value = state.actualWatts;
                document.getElementById('simWattReadout').textContent = `${state.actualWatts} W`;
            } else {
                bar.classList.add('hidden');
                text.textContent = 'Sim Mode: OFF';
                btn.className = 'px-2.5 py-2 rounded-xl font-semibold text-xs flex items-center gap-1.5 bg-gray-800/90 hover:bg-gray-700 text-gray-300 border border-gray-700 transition cursor-pointer';
                if (!bleTrainer.connected && !bleRower.connected) {
                    state.actualWatts = 0;
                    if (!bleCadenceSensor.connected) state.cadence = 0;
                    if (!bleSpeedSensor.connected) state.speedKmh = 0;
                }
            }
            updateHeaderAndSetupVisibility();
            updateLiveHud();
        }

