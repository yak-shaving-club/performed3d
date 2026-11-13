// =========================================================================
// GHOST RIDES: save a finished ride and race against it later
// =========================================================================
const GHOST_FILE_FORMAT = 'loop-kicker-journey-ghost';
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
    if (!data || data.format !== GHOST_FILE_FORMAT || data.version !== GHOST_FILE_VERSION) {
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
