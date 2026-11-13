        // =========================================================================
        // 4. WEB BLUETOOTH CONTROLLERS: WAHOO KICKR (CPS + FTMS), HRM (0x180D) & CSC SPEED/CADENCE (0x1816)
        // =========================================================================
        const BLE_UUIDS = {
            CYCLING_POWER_SERVICE: 0x1818,
            CYCLING_POWER_MEASUREMENT: 0x2A63,
            WAHOO_CONTROL_POINT: 'a026e005-0a7d-4ab3-97fa-f1500f9feb8b',
            FITNESS_MACHINE_SERVICE: 0x1826,
            INDOOR_BIKE_DATA: 0x2AD2,
            FTMS_CONTROL_POINT: 0x2AD9,
            HEART_RATE_SERVICE: 0x180D,
            HEART_RATE_MEASUREMENT: 0x2A37,
            CSC_SERVICE: 0x1816,
            CSC_MEASUREMENT: 0x2A5B,
            ELITE_STEERING_SERVICE: '347b0001-7635-408b-8918-8ff3949ce592',
            ELITE_STEERING_ANGLE_CHAR: '347b0030-7635-408b-8918-8ff3949ce592',
            ELITE_STEERING_CONTROL_CHAR: '347b0031-7635-408b-8918-8ff3949ce592',
            ELITE_STEERING_CHALLENGE_CHAR: '347b0032-7635-408b-8918-8ff3949ce592',
            ELITE_ARIA_SERVICE: '347b0001-7635-408b-8918-8ff3949ce592',
            ELITE_ARIA_SETUP_CHAR: '347b0012-7635-408b-8918-8ff3949ce592',
            ELITE_ARIA_CONTROL_CHAR: '347b0040-7635-408b-8918-8ff3949ce592',
            // Concept2 PM5 (PM Bluetooth Smart Communications Interface Definition)
            C2_DISCOVERY_SERVICE: 'ce060000-43e5-11e4-916c-0800200c9a66',
            C2_ROWING_SERVICE: 'ce060030-43e5-11e4-916c-0800200c9a66',
            C2_ADDITIONAL_STATUS_1_CHAR: 'ce060032-43e5-11e4-916c-0800200c9a66',
            C2_SAMPLE_RATE_CHAR: 'ce060034-43e5-11e4-916c-0800200c9a66',
            C2_ADDITIONAL_STROKE_DATA_CHAR: 'ce060036-43e5-11e4-916c-0800200c9a66'
        };

        const DEFAULT_WHEEL_CIRCUMFERENCE_METERS = 2.105; // 700x25c road wheel circumference in meters
        const KICKR_POLL_INTERVAL_MS = 250;
        const DRAGON_POWER_AVG_WINDOW_MS = 3000;
        const ELITE_STEER_DEADZONE_DEG = 1.2;
        const ELITE_STEER_MAX_ANGLE_DEG = 30.0;

        class BleHeartRateMonitor {
            constructor(onHeartRateCallback, onStatusCallback) {
                this.onHeartRate = onHeartRateCallback;
                this.onStatus = onStatusCallback;
                this.device = null;
                this.server = null;
                this.hrChar = null;
                this.latestBpm = null;
                this.connected = false;
            }

            async connect(knownDevice = null) {
                if (!navigator.bluetooth) {
                    throw new Error('Web Bluetooth is not supported in this browser. Use Chrome/Edge.');
                }

                this.onStatus('connecting', 'Pairing HRM...');
                this.device = knownDevice || await navigator.bluetooth.requestDevice({
                    filters: [
                        { services: [BLE_UUIDS.HEART_RATE_SERVICE] },
                        { namePrefix: 'HRM' },
                        { namePrefix: 'Garmin' },
                        { namePrefix: 'TICKR' },
                        { namePrefix: 'Polar' }
                    ],
                    optionalServices: [BLE_UUIDS.HEART_RATE_SERVICE]
                });

                this.device.addEventListener('gattserverdisconnected', () => {
                    this.connected = false;
                    this.hrChar = null;
                    this.latestBpm = null;
                    this.onHeartRate(null);
                    this.onStatus('disconnected', 'Pair HRM');
                });

                this.server = await this.device.gatt.connect();
                const hrService = await this.server.getPrimaryService(BLE_UUIDS.HEART_RATE_SERVICE);
                this.hrChar = await hrService.getCharacteristic(BLE_UUIDS.HEART_RATE_MEASUREMENT);
                await this.hrChar.startNotifications();
                this.hrChar.addEventListener('characteristicvaluechanged', (e) => {
                    this.parseHeartRateMeasurement(e.target.value);
                });

                this.connected = true;
                this.onStatus('connected', this.device.name || 'HRM Connected');
            }

            parseHeartRateMeasurement(dataView) {
                if (!dataView || dataView.byteLength < 2) return null;
                const flags = dataView.getUint8(0);
                const is16Bit = (flags & 0x01) !== 0;
                let bpm;
                if (is16Bit) {
                    if (dataView.byteLength < 3) return null;
                    bpm = dataView.getUint16(1, true);
                } else {
                    bpm = dataView.getUint8(1);
                }
                if (bpm > 0 && bpm < 260) {
                    this.latestBpm = bpm;
                    this.onHeartRate(bpm);
                }
                return bpm;
            }
        }

        class BleCyclingSpeedCadenceSensor {
            constructor(sensorRole, onMeasurementCallback, onStatusCallback) {
                this.sensorRole = sensorRole; // 'cadence' or 'speed'
                this.onMeasurement = onMeasurementCallback;
                this.onStatus = onStatusCallback;
                this.device = null;
                this.server = null;
                this.cscChar = null;
                this.prevWheelRevs = null;
                this.prevWheelTime = null;
                this.prevCrankRevs = null;
                this.prevCrankTime = null;
                this.latestCadence = null;
                this.latestSpeedKmh = null;
                this.wheelCircumferenceMeters = DEFAULT_WHEEL_CIRCUMFERENCE_METERS;
                this.connected = false;
            }

            async connect(knownDevice = null) {
                if (!navigator.bluetooth) {
                    throw new Error('Web Bluetooth is not supported in this browser. Use Chrome/Edge.');
                }

                const roleLabel = this.sensorRole === 'speed' ? 'Speed' : 'Cadence';
                this.onStatus('connecting', `Pairing ${roleLabel}...`);
                this.device = knownDevice || await navigator.bluetooth.requestDevice({
                    filters: [
                        { services: [BLE_UUIDS.CSC_SERVICE] },
                        { namePrefix: 'Garmin' },
                        { namePrefix: 'Wahoo' },
                        { namePrefix: 'CADENCE' },
                        { namePrefix: 'SPEED' },
                        { namePrefix: 'RPM' }
                    ],
                    optionalServices: [BLE_UUIDS.CSC_SERVICE]
                });

                this.device.addEventListener('gattserverdisconnected', () => {
                    this.connected = false;
                    this.cscChar = null;
                    this.prevWheelRevs = null;
                    this.prevWheelTime = null;
                    this.prevCrankRevs = null;
                    this.prevCrankTime = null;
                    this.onStatus('disconnected', `Pair ${roleLabel}`);
                });

                this.server = await this.device.gatt.connect();
                const cscService = await this.server.getPrimaryService(BLE_UUIDS.CSC_SERVICE);
                this.cscChar = await cscService.getCharacteristic(BLE_UUIDS.CSC_MEASUREMENT);
                await this.cscChar.startNotifications();
                this.cscChar.addEventListener('characteristicvaluechanged', (e) => {
                    this.parseCscMeasurement(e.target.value);
                });

                this.connected = true;
                this.onStatus('connected', this.device.name || `${roleLabel} Sensor`);
            }

            parseCscMeasurement(dataView) {
                if (!dataView || dataView.byteLength < 1) return;
                const flags = dataView.getUint8(0);
                const hasWheelData = (flags & 0x01) !== 0;
                const hasCrankData = (flags & 0x02) !== 0;
                let offset = 1;
                let speedKmh = null;
                let cadence = null;

                if (hasWheelData && dataView.byteLength >= offset + 6) {
                    const wheelRevs = dataView.getUint32(offset, true);
                    const wheelTime = dataView.getUint16(offset + 4, true);
                    offset += 6;
                    if (this.prevWheelRevs !== null && this.prevWheelTime !== null) {
                        const revDiff = (wheelRevs - this.prevWheelRevs) >>> 0;
                        const timeDiff = (wheelTime - this.prevWheelTime + 65536) % 65536;
                        if (timeDiff > 0 && revDiff < 50) {
                            const speedMps = (revDiff * this.wheelCircumferenceMeters * 1024) / timeDiff;
                            speedKmh = Math.max(0, +(speedMps * 3.6).toFixed(1));
                        } else if (revDiff === 0 && timeDiff > 2048) {
                            speedKmh = 0;
                        }
                    }
                    this.prevWheelRevs = wheelRevs;
                    this.prevWheelTime = wheelTime;
                }

                if (hasCrankData && dataView.byteLength >= offset + 4) {
                    const crankRevs = dataView.getUint16(offset, true);
                    const crankTime = dataView.getUint16(offset + 2, true);
                    offset += 4;
                    if (this.prevCrankRevs !== null && this.prevCrankTime !== null) {
                        const revDiff = (crankRevs - this.prevCrankRevs + 65536) % 65536;
                        const timeDiff = (crankTime - this.prevCrankTime + 65536) % 65536;
                        if (timeDiff > 0 && revDiff < 25) {
                            cadence = Math.round((revDiff * 1024 * 60) / timeDiff);
                        } else if (revDiff === 0 && timeDiff > 2048) {
                            cadence = 0;
                        }
                    }
                    this.prevCrankRevs = crankRevs;
                    this.prevCrankTime = crankTime;
                }

                if (speedKmh !== null) this.latestSpeedKmh = speedKmh;
                if (cadence !== null) this.latestCadence = cadence;
                this.onMeasurement({ speedKmh, cadence });
            }
        }

        const STERZO_CHALLENGE_TABLE = typeof STERZO_CHALLENGE_TABLE_B64 !== 'undefined'
            ? Uint8Array.from(atob(STERZO_CHALLENGE_TABLE_B64), c => c.charCodeAt(0))
            : new Uint8Array(0);
        const sleepMs = (ms) => new Promise(r => setTimeout(r, ms));

        class BleEliteSteeringSensor {
            constructor(onSteeringAngleCallback, onStatusCallback) {
                this.onSteeringAngle = onSteeringAngleCallback;
                this.onStatus = onStatusCallback;
                this.device = null;
                this.server = null;
                this.steerChar = null;
                this.controlChar = null;
                this.challengeChar = null;
                this.zeroAngleOffsetDeg = 0.0;
                this.latestAngleDeg = 0.0;
                this.connected = false;
            }

            async connect(knownDevice = null) {
                if (!navigator.bluetooth) {
                    throw new Error('Web Bluetooth is not supported in this browser. Use Chrome/Edge.');
                }

                this.onStatus('connecting', 'Pairing Sterzo / Rizer...');
                this.device = knownDevice || await navigator.bluetooth.requestDevice({
                    filters: [
                        { services: [BLE_UUIDS.ELITE_STEERING_SERVICE] },
                        { namePrefix: 'STERZO' },
                        { namePrefix: 'Sterzo' },
                        { namePrefix: 'RIZER' },
                        { namePrefix: 'Rizer' },
                        { namePrefix: 'ELITE' },
                        { namePrefix: 'Elite' }
                    ],
                    optionalServices: [
                        BLE_UUIDS.ELITE_STEERING_SERVICE,
                        BLE_UUIDS.FITNESS_MACHINE_SERVICE
                    ]
                });

                this.device.addEventListener('gattserverdisconnected', () => {
                    this.connected = false;
                    this.steerChar = null;
                    this.controlChar = null;
                    this.challengeChar = null;
                    this.latestAngleDeg = 0.0;
                    this.onSteeringAngle(0.0, null);
                    this.onStatus('disconnected', 'Pair Sterzo / Rizer');
                });

                this.server = await this.device.gatt.connect();
                const steeringService = await this.server.getPrimaryService(BLE_UUIDS.ELITE_STEERING_SERVICE);
                this.steerChar = await steeringService.getCharacteristic(BLE_UUIDS.ELITE_STEERING_ANGLE_CHAR);
                // 0x0031 = control (write), 0x0032 = indications (challenge comes back here)
                this.controlChar = await steeringService.getCharacteristic(BLE_UUIDS.ELITE_STEERING_CONTROL_CHAR);
                this.challengeChar = await steeringService.getCharacteristic(BLE_UUIDS.ELITE_STEERING_CHALLENGE_CHAR);

                let resolveChallenge;
                const challengePromise = new Promise(r => resolveChallenge = r);
                this.challengeChar.addEventListener('characteristicvaluechanged', (e) => {
                    const b = new Uint8Array(e.target.value.buffer);
                    if (b.length >= 4 && b[0] === 0x03 && b[1] === 0x10) {
                        resolveChallenge((b[2] << 8) | b[3]);
                    }
                });
                this.steerChar.addEventListener('characteristicvaluechanged', (e) => {
                    this.parseSteeringMeasurement(e.target.value);
                });

                // Both must be subscribed before requesting the challenge
                await this.challengeChar.startNotifications();
                await this.steerChar.startNotifications();
                await sleepMs(500);

                let challenge = null;
                for (let attempt = 1; attempt <= 3 && challenge === null; attempt++) {
                    await this.controlChar.writeValueWithResponse(new Uint8Array([0x03, 0x10]));
                    challenge = await Promise.race([challengePromise, sleepMs(5000).then(() => null)]);
                }
                if (challenge === null) throw new Error('Sterzo did not send a challenge');

                await this.controlChar.writeValueWithResponse(new Uint8Array([
                    0x03, 0x11,
                    STERZO_CHALLENGE_TABLE[challenge * 2],
                    STERZO_CHALLENGE_TABLE[challenge * 2 + 1]
                ]));
                await sleepMs(1000);
                await this.controlChar.writeValueWithResponse(new Uint8Array([0x02, 0x02]));

                this.connected = true;
                this.zeroAngleOffsetDeg = 0.0;
                this.onStatus('connected', this.device.name || 'Sterzo / Rizer');
            }

            recenter() {
                this.zeroAngleOffsetDeg = this.latestAngleDeg || 0.0;
                this.onSteeringAngle(0.0, 0.0);
            }

            parseSteeringMeasurement(dataView) {
                if (!dataView || dataView.byteLength < 4) return null;
                const rawAngleDeg = dataView.getFloat32(0, true);
                if (!Number.isFinite(rawAngleDeg) || Math.abs(rawAngleDeg) > 90) return null;
                this.latestAngleDeg = rawAngleDeg;
                const calibratedDeg = rawAngleDeg - this.zeroAngleOffsetDeg;
                const effectiveDeg = Math.abs(calibratedDeg) <= ELITE_STEER_DEADZONE_DEG ? 0.0 : calibratedDeg;
                const normalizedInput = Math.max(-1.0, Math.min(1.0, effectiveDeg / ELITE_STEER_MAX_ANGLE_DEG));
                this.onSteeringAngle(normalizedInput, calibratedDeg);
                return calibratedDeg;
            }
        }

        class PhoneWebRtcSteeringSensor {
            constructor(onSteeringAngleCallback, onFireCallback, onStatusCallback) {
                this.onSteeringAngle = onSteeringAngleCallback;
                this.onFire = onFireCallback;
                this.onStatus = onStatusCallback;
                this.peer = null;
                this.conn = null;
                this.peerId = null;
                this.connected = false;
                this.zeroAngleOffsetDeg = 0.0;
                this.latestAngleDeg = 0.0;
            }

            async ensureHostPeer() {
                if (this.peer && !this.peer.destroyed && this.peerId) {
                    return this.peerId;
                }
                if (typeof Peer === 'undefined') {
                    throw new Error('PeerJS WebRTC library failed to load.');
                }
                this.onStatus('connecting', 'Waiting for Phone...');
                return new Promise((resolve, reject) => {
                    let savedId = localStorage.getItem('performed_phone_host_peer_id');
                    if (!savedId || !savedId.startsWith('p3d-steer-')) {
                        const randomSuffix = Math.random().toString(36).substring(2, 8);
                        savedId = `p3d-steer-${randomSuffix}`;
                        localStorage.setItem('performed_phone_host_peer_id', savedId);
                    }
                    const peer = new Peer(savedId);
                    this.peer = peer;

                    peer.on('open', (id) => {
                        this.peerId = id;
                        localStorage.setItem('performed_phone_host_peer_id', id);
                        this.onStatus('connecting', `Waiting (${id})`);
                        resolve(id);
                    });

                    peer.on('connection', (conn) => {
                        if (this.conn && this.conn !== conn) {
                            try { this.conn.close(); } catch (_) {}
                        }
                        this.conn = conn;
                        this.onStatus('connecting', 'Phone ICE Handshake...');
                        conn.on('open', () => {
                            if (this.conn !== conn) return;
                            this.connected = true;
                            this.zeroAngleOffsetDeg = 0.0;
                            this.onStatus('connected', 'Phone Connected');
                        });
                        conn.on('data', (data) => {
                            if (this.conn === conn && this.connected) {
                                this.handleMessage(data);
                            }
                        });
                        conn.on('close', () => {
                            if (this.conn === conn) {
                                this.connected = false;
                                this.conn = null;
                                this.latestAngleDeg = 0.0;
                                this.onSteeringAngle(0.0, null);
                                this.onStatus('disconnected', 'Phone Steer (QR)');
                            }
                        });
                        conn.on('error', () => {
                            if (this.conn === conn) {
                                this.connected = false;
                                this.conn = null;
                                this.onSteeringAngle(0.0, null);
                                this.onStatus('disconnected', 'Phone Steer (QR)');
                            }
                        });
                    });

                    peer.on('error', (err) => {
                        if (err && err.type === 'unavailable-id') {
                            localStorage.removeItem('performed_phone_host_peer_id');
                            try { peer.destroy(); } catch (_) {}
                            this.peer = null;
                            this.ensureHostPeer().then(resolve).catch(reject);
                            return;
                        }
                        if (!this.peerId) {
                            reject(err);
                        }
                    });
                });
            }

            handleMessage(msg) {
                if (!this.connected || !this.conn || !msg || typeof msg !== 'object') return;
                if (msg.type === 'steer') {
                    const rawDeg = Number(msg.angleDeg);
                    if (!Number.isFinite(rawDeg)) return;
                    this.latestAngleDeg = rawDeg;
                    const calibratedDeg = rawDeg - this.zeroAngleOffsetDeg;
                    const effectiveDeg = Math.abs(calibratedDeg) <= ELITE_STEER_DEADZONE_DEG ? 0.0 : calibratedDeg;
                    const normalizedInput = Math.max(-1.0, Math.min(1.0, effectiveDeg / ELITE_STEER_MAX_ANGLE_DEG));
                    this.onSteeringAngle(normalizedInput, calibratedDeg);
                } else if (msg.type === 'recenter') {
                    this.zeroAngleOffsetDeg = 0.0;
                    this.latestAngleDeg = 0.0;
                    this.onSteeringAngle(0.0, 0.0);
                } else if (msg.type === 'fire') {
                    if (this.onFire) this.onFire();
                }
            }

            recenter() {
                this.zeroAngleOffsetDeg = this.latestAngleDeg || 0.0;
                this.onSteeringAngle(0.0, 0.0);
                if (this.conn && this.connected) {
                    try { this.conn.send({ type: 'recenter' }); } catch (_) {}
                }
            }

            disconnect() {
                localStorage.removeItem('performed_phone_host_peer_id');
                const activeConn = this.conn;
                const activePeer = this.peer;
                this.conn = null;
                this.peer = null;
                this.peerId = null;
                this.connected = false;
                this.latestAngleDeg = 0.0;
                this.zeroAngleOffsetDeg = 0.0;
                this.onSteeringAngle(0.0, null);
                this.onStatus('disconnected', 'Phone Steer (QR)');
                if (activeConn) {
                    try { activeConn.send({ type: 'disconnect' }); } catch (_) {}
                    setTimeout(() => {
                        try { activeConn.close(); } catch (_) {}
                        if (activePeer && !activePeer.destroyed) {
                            try { activePeer.destroy(); } catch (_) {}
                        }
                    }, 60);
                } else if (activePeer && !activePeer.destroyed) {
                    try { activePeer.destroy(); } catch (_) {}
                }
            }
        }

        class BleEliteAriaFan {
            constructor(onStatusCallback) {
                this.onStatus = onStatusCallback;
                this.device = null;
                this.server = null;
                this.setupChar = null;
                this.controlChar = null;
                this.connected = false;
                this.lastSpeed = null;
                this.writeQueue = Promise.resolve();
            }

            async connect(knownDevice = null) {
                if (!navigator.bluetooth) {
                    throw new Error('Web Bluetooth is not supported in this browser. Use Chrome/Edge.');
                }

                this.onStatus('connecting', 'Pairing Elite Aria...');
                this.device = knownDevice || await navigator.bluetooth.requestDevice({
                    filters: [{ namePrefix: 'ARIA' }],
                    optionalServices: [BLE_UUIDS.ELITE_ARIA_SERVICE]
                });

                this.device.addEventListener('gattserverdisconnected', () => {
                    this.connected = false;
                    this.setupChar = null;
                    this.controlChar = null;
                    this.lastSpeed = null;
                    this.onStatus('disconnected', 'Pair Elite Aria');
                });

                try {
                    this.server = await this.device.gatt.connect();
                    const service = await this.server.getPrimaryService(BLE_UUIDS.ELITE_ARIA_SERVICE);
                    this.setupChar = await service.getCharacteristic(BLE_UUIDS.ELITE_ARIA_SETUP_CHAR);
                    this.controlChar = await service.getCharacteristic(BLE_UUIDS.ELITE_ARIA_CONTROL_CHAR);
                    await this.setupChar.writeValueWithResponse(new Uint8Array([0x02, 0x00, 0x00, 0x3d, 0x00]));
                    await this.controlChar.writeValueWithResponse(new Uint8Array([0x05, 0x00]));

                    this.connected = true;
                    this.lastSpeed = null;
                    await this.setHeartRate(null);
                } catch (err) {
                    this.connected = false;
                    this.setupChar = null;
                    this.controlChar = null;
                    if (this.device.gatt.connected) this.device.gatt.disconnect();
                    throw err;
                }
            }

            async setHeartRate(bpm) {
                if (!this.connected || !this.controlChar) return;
                const normalizedHeartRate = Number.isFinite(bpm) ? bpm : 0;
                const speed = normalizedHeartRate <= 80
                    ? 0
                    : Math.min(100, Math.round(normalizedHeartRate - 80));
                const write = this.writeQueue.catch(() => {}).then(async () => {
                    if (!this.connected || !this.controlChar || speed === this.lastSpeed) return;
                    await this.controlChar.writeValueWithResponse(new Uint8Array([0x03, 0x01, speed]));
                    this.lastSpeed = speed;
                    const name = (this.device && this.device.name) || 'Elite Aria';
                    this.onStatus('connected', `${name} ${speed}%`);
                });
                this.writeQueue = write;
                await write;
            }
        }

        const C2_STROKE_POWER_STALE_MS = 4000;

        // Concept2 rowing ergometer (RowErg, SkiErg, BikeErg) via PM5 monitor. Read-only: the PM5
        // does not accept resistance control, so power is driven entirely by the athlete.
        class BleConcept2Rower {
            constructor(onTelemetryCallback, onStatusCallback) {
                this.onTelemetry = onTelemetryCallback;
                this.onStatus = onStatusCallback;
                this.device = null;
                this.server = null;
                this.status1Char = null;
                this.strokeChar = null;
                this.latestWatts = null;
                this.latestStrokeRate = null;
                this.latestSpeedKmh = null;
                this.latestHeartRate = null;
                this.lastStrokePowerAt = -Infinity;
                this.connected = false;
            }

            async connect(knownDevice = null) {
                if (!navigator.bluetooth) {
                    throw new Error('Web Bluetooth is not supported in this browser. Use Chrome/Edge or enable Sim Mode.');
                }

                this.onStatus('connecting', 'Pairing Concept2...');
                this.device = knownDevice || await navigator.bluetooth.requestDevice({
                    filters: [
                        { services: [BLE_UUIDS.C2_DISCOVERY_SERVICE] },
                        { namePrefix: 'PM5' }
                    ],
                    optionalServices: [BLE_UUIDS.C2_ROWING_SERVICE]
                });

                this.device.addEventListener('gattserverdisconnected', () => {
                    this.connected = false;
                    this.status1Char = null;
                    this.strokeChar = null;
                    this.latestWatts = null;
                    this.latestStrokeRate = null;
                    this.latestSpeedKmh = null;
                    this.latestHeartRate = null;
                    this.onStatus('disconnected', 'Connect Concept2');
                });

                this.server = await this.device.gatt.connect();
                try {
                    const rowing = await this.server.getPrimaryService(BLE_UUIDS.C2_ROWING_SERVICE);

                    try {
                        // 0 = 1 s, 1 = 500 ms, 2 = 250 ms, 3 = 100 ms
                        const rateChar = await rowing.getCharacteristic(BLE_UUIDS.C2_SAMPLE_RATE_CHAR);
                        await rateChar.writeValue(new Uint8Array([0x02]));
                    } catch (_) {}

                    this.status1Char = await rowing.getCharacteristic(BLE_UUIDS.C2_ADDITIONAL_STATUS_1_CHAR);
                    await this.status1Char.startNotifications();
                    this.status1Char.addEventListener('characteristicvaluechanged', (e) => {
                        this.parseAdditionalStatus1(e.target.value);
                    });

                    this.strokeChar = await rowing.getCharacteristic(BLE_UUIDS.C2_ADDITIONAL_STROKE_DATA_CHAR);
                    await this.strokeChar.startNotifications();
                    this.strokeChar.addEventListener('characteristicvaluechanged', (e) => {
                        this.parseAdditionalStrokeData(e.target.value);
                    });
                } catch (err) {
                    this.connected = false;
                    if (this.device.gatt.connected) this.device.gatt.disconnect();
                    throw err;
                }

                this.connected = true;
                this.onStatus('connected', this.device.name || 'Concept2 PM5');
            }

            // Characteristic 0x0032: elapsed time (3), speed (2, 0.001 m/s), stroke rate (1, spm),
            // heart rate (1, bpm, 255 = invalid), current pace (2), ...
            parseAdditionalStatus1(dataView) {
                if (!dataView || dataView.byteLength < 7) return;
                const speedMps = dataView.getUint16(3, true) / 1000.0;
                const strokeRate = dataView.getUint8(5);
                const heartRate = dataView.getUint8(6);
                this.latestSpeedKmh = speedMps * 3.6;
                this.latestStrokeRate = strokeRate;
                this.latestHeartRate = (heartRate > 0 && heartRate < 255) ? heartRate : null;
                // Stroke power only updates once per stroke; when strokes stop, derive power from
                // the decaying boat speed using Concept2's formula P = 2.80 * v^3.
                if (performance.now() - this.lastStrokePowerAt > C2_STROKE_POWER_STALE_MS) {
                    this.latestWatts = Math.max(0, Math.round(2.8 * speedMps * speedMps * speedMps));
                }
                this.emitTelemetry();
            }

            // Characteristic 0x0036: elapsed time (3), stroke power (2, W), stroke calories (2), ...
            parseAdditionalStrokeData(dataView) {
                if (!dataView || dataView.byteLength < 5) return;
                this.latestWatts = Math.max(0, dataView.getUint16(3, true));
                this.lastStrokePowerAt = performance.now();
                this.emitTelemetry();
            }

            emitTelemetry() {
                this.onTelemetry({
                    watts: this.latestWatts,
                    cadence: this.latestStrokeRate,
                    speedKmh: this.latestSpeedKmh,
                    heartRate: this.latestHeartRate
                });
            }
        }

        class WahooKickrBluetooth {
            constructor(onTelemetryCallback, onStatusCallback) {
                this.onTelemetry = onTelemetryCallback;
                this.onStatus = onStatusCallback;
                this.device = null;
                this.server = null;
                this.cpChar = null;
                this.bikeDataChar = null;
                this.ftmsControlPoint = null;
                this.wahooControlPoint = null;
                this.prevCrankRevs = null;
                this.prevCrankTime = null;
                this.lastSentErgWatts = null;
                this.lastSentGradePct = null;
                this.latestWatts = null;
                this.latestCadence = null;
                this.latestSpeedKmh = null;
                this.pollIntervalId = null;
                this.isPollingRead = false;
                this.connected = false;
            }

            async connect(knownDevice = null) {
                if (!navigator.bluetooth) {
                    throw new Error('Web Bluetooth is not supported in this browser. Use Chrome/Edge or enable Sim Mode.');
                }

                this.onStatus('connecting', 'Pairing KICKR...');
                this.device = knownDevice || await navigator.bluetooth.requestDevice({
                    filters: [
                        { services: [BLE_UUIDS.CYCLING_POWER_SERVICE] },
                        { services: [BLE_UUIDS.FITNESS_MACHINE_SERVICE] },
                        { namePrefix: 'KICKR' },
                        { namePrefix: 'Wahoo' }
                    ],
                    optionalServices: [
                        BLE_UUIDS.CYCLING_POWER_SERVICE,
                        BLE_UUIDS.FITNESS_MACHINE_SERVICE,
                        BLE_UUIDS.WAHOO_CONTROL_POINT
                    ]
                });

                this.device.addEventListener('gattserverdisconnected', () => {
                    this.stopFrequentWattPolling();
                    this.connected = false;
                    this.cpChar = null;
                    this.bikeDataChar = null;
                    this.ftmsControlPoint = null;
                    this.wahooControlPoint = null;
                    this.onStatus('disconnected', 'KICKR Disconnected');
                });

                this.server = await this.device.gatt.connect();

                try {
                    const cps = await this.server.getPrimaryService(BLE_UUIDS.CYCLING_POWER_SERVICE);
                    const cpChar = await cps.getCharacteristic(BLE_UUIDS.CYCLING_POWER_MEASUREMENT);
                    this.cpChar = cpChar;
                    await cpChar.startNotifications();
                    cpChar.addEventListener('characteristicvaluechanged', (e) => {
                        this.parseCyclingPowerMeasurement(e.target.value, false);
                    });
                    try {
                        this.wahooControlPoint = await cps.getCharacteristic(BLE_UUIDS.WAHOO_CONTROL_POINT);
                        await this.wahooControlPoint.startNotifications();
                        await this.wahooControlPoint.writeValue(new Uint8Array([0x20, 0xEE, 0xFC]));
                    } catch (_) {}
                } catch (_) {}

                try {
                    const ftms = await this.server.getPrimaryService(BLE_UUIDS.FITNESS_MACHINE_SERVICE);
                    try {
                        const bikeDataChar = await ftms.getCharacteristic(BLE_UUIDS.INDOOR_BIKE_DATA);
                        this.bikeDataChar = bikeDataChar;
                        await bikeDataChar.startNotifications();
                        bikeDataChar.addEventListener('characteristicvaluechanged', (e) => {
                            this.parseIndoorBikeData(e.target.value, false);
                        });
                    } catch (_) {}

                    try {
                        this.ftmsControlPoint = await ftms.getCharacteristic(BLE_UUIDS.FTMS_CONTROL_POINT);
                        await this.ftmsControlPoint.startNotifications();
                        await this.ftmsControlPoint.writeValue(new Uint8Array([0x00]));
                    } catch (_) {}
                } catch (_) {}

                this.connected = true;
                this.startFrequentWattPolling();
                this.onStatus('connected', this.device.name || 'Wahoo KICKR Core');
            }

            startFrequentWattPolling() {
                this.stopFrequentWattPolling();
                this.pollIntervalId = setInterval(() => {
                    this.pollCurrentWatts();
                }, KICKR_POLL_INTERVAL_MS);
            }

            stopFrequentWattPolling() {
                if (this.pollIntervalId !== null) {
                    clearInterval(this.pollIntervalId);
                    this.pollIntervalId = null;
                }
                this.isPollingRead = false;
            }

            async pollCurrentWatts() {
                if (!this.connected || this.isPollingRead) return;
                this.isPollingRead = true;
                let updatedFromRead = false;
                try {
                    if (this.cpChar && typeof this.cpChar.readValue === 'function') {
                        try {
                            const dataView = await this.cpChar.readValue();
                            if (dataView && dataView.byteLength >= 4) {
                                this.parseCyclingPowerMeasurement(dataView);
                                updatedFromRead = true;
                            }
                        } catch (_) {}
                    }
                    if (!updatedFromRead && this.bikeDataChar && typeof this.bikeDataChar.readValue === 'function') {
                        try {
                            const dataView = await this.bikeDataChar.readValue();
                            if (dataView && dataView.byteLength >= 4) {
                                this.parseIndoorBikeData(dataView);
                                updatedFromRead = true;
                            }
                        } catch (_) {}
                    }
                    if (!updatedFromRead) {
                        if (this.cpChar && this.cpChar.value && this.cpChar.value.byteLength >= 4) {
                            this.parseCyclingPowerMeasurement(this.cpChar.value);
                            updatedFromRead = true;
                        } else if (this.bikeDataChar && this.bikeDataChar.value && this.bikeDataChar.value.byteLength >= 4) {
                            this.parseIndoorBikeData(this.bikeDataChar.value);
                            updatedFromRead = true;
                        } else if (this.latestWatts !== null) {
                            this.onTelemetry({
                                watts: this.latestWatts,
                                cadence: this.latestCadence,
                                speedKmh: this.latestSpeedKmh
                            });
                        }
                    }
                } finally {
                    this.isPollingRead = false;
                }
            }

            parseCyclingPowerMeasurement(dataView, emitTelemetry = true) {
                if (!dataView || dataView.byteLength < 4) return;
                const flags = dataView.getUint16(0, true);
                const watts = Math.max(0, dataView.getInt16(2, true));
                let offset = 4;
                if (flags & 0x0001) offset += 1;
                if (flags & 0x0004) offset += 2;
                if (flags & 0x0010) offset += 6;

                let cadence = null;
                if ((flags & 0x0020) && dataView.byteLength >= offset + 4) {
                    const crankRevs = dataView.getUint16(offset, true);
                    const crankTime = dataView.getUint16(offset + 2, true);
                    if (this.prevCrankRevs !== null && this.prevCrankTime !== null) {
                        const revDiff = (crankRevs - this.prevCrankRevs + 65536) % 65536;
                        const timeDiff = (crankTime - this.prevCrankTime + 65536) % 65536;
                        if (timeDiff > 0 && revDiff < 20) {
                            cadence = Math.round((revDiff * 1024 * 60) / timeDiff);
                        }
                    }
                    this.prevCrankRevs = crankRevs;
                    this.prevCrankTime = crankTime;
                }
                this.latestWatts = watts;
                if (cadence !== null) this.latestCadence = cadence;
                if (emitTelemetry) {
                    this.onTelemetry({ watts: this.latestWatts, cadence: this.latestCadence, speedKmh: this.latestSpeedKmh });
                }
            }

            parseIndoorBikeData(dataView, emitTelemetry = true) {
                if (!dataView || dataView.byteLength < 4) return;
                const flags = dataView.getUint16(0, true);
                let offset = 2;
                let speedKmh = null;
                if ((flags & 0x0001) === 0 && dataView.byteLength >= offset + 2) {
                    speedKmh = dataView.getUint16(offset, true) / 100.0;
                    offset += 2;
                }
                if (flags & 0x0002) offset += 2;
                let cadence = null;
                if ((flags & 0x0004) && dataView.byteLength >= offset + 2) {
                    cadence = Math.round(dataView.getUint16(offset, true) * 0.5);
                    offset += 2;
                }
                if (flags & 0x0008) offset += 2;
                if (flags & 0x0010) offset += 3;
                if (flags & 0x0020) offset += 2;
                let watts = null;
                if ((flags & 0x0040) && dataView.byteLength >= offset + 2) {
                    watts = Math.max(0, dataView.getInt16(offset, true));
                }
                if (watts !== null) this.latestWatts = watts;
                if (cadence !== null) this.latestCadence = cadence;
                if (speedKmh !== null) this.latestSpeedKmh = speedKmh;
                if (emitTelemetry) {
                    this.onTelemetry({ watts: this.latestWatts, cadence: this.latestCadence, speedKmh: this.latestSpeedKmh });
                }
            }

            async setErgTargetWatts(targetWatts) {
                if (!this.connected) return;
                const clamped = Math.max(25, Math.min(1800, Math.round(targetWatts)));
                if (this.lastSentErgWatts === clamped) return;
                this.lastSentErgWatts = clamped;
                this.lastSentGradePct = null;

                if (this.ftmsControlPoint) {
                    try {
                        await this.ftmsControlPoint.writeValue(new Uint8Array([0x05, clamped & 0xFF, (clamped >> 8) & 0xFF]));
                        return;
                    } catch (_) {}
                }
                if (this.wahooControlPoint) {
                    try {
                        await this.wahooControlPoint.writeValue(new Uint8Array([0x42, clamped & 0xFF, (clamped >> 8) & 0xFF]));
                    } catch (_) {}
                }
            }

            async setSimulationGrade(gradePct) {
                if (!this.connected) return;
                const clampedGrade = Math.max(-10.0, Math.min(15.0, +gradePct.toFixed(1)));
                if (this.lastSentGradePct === clampedGrade) return;
                this.lastSentGradePct = clampedGrade;
                this.lastSentErgWatts = null;

                if (this.ftmsControlPoint) {
                    try {
                        const gradeRaw = Math.round(clampedGrade * 100);
                        const payload = new Uint8Array(7);
                        const view = new DataView(payload.buffer);
                        view.setUint8(0, 0x11);
                        view.setInt16(1, 0, true);
                        view.setInt16(3, gradeRaw, true);
                        view.setUint8(5, 40);
                        view.setUint8(6, 51);
                        await this.ftmsControlPoint.writeValue(payload);
                        return;
                    } catch (_) {}
                }
                if (this.wahooControlPoint) {
                    try {
                        const slopeFraction = clampedGrade / 100.0;
                        const wahooRaw = Math.round(Math.max(-1, Math.min(1, slopeFraction)) * 32767);
                        const payload = new Uint8Array(3);
                        const view = new DataView(payload.buffer);
                        view.setUint8(0, 0x46);
                        view.setInt16(1, wahooRaw, true);
                        await this.wahooControlPoint.writeValue(payload);
                    } catch (_) {}
                }
            }
        }

