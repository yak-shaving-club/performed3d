// =========================================================================
// STANDALONE MOBILE PHONE CONTROLLER BOOTSTRAP (runs before desktop engine)
// =========================================================================
(function bootstrapMobileControllerIfRequested() {
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.has('phone-steer') && !urlParams.has('steer')) {
        return;
    }
    const hostPeerId = (urlParams.get('phone-steer') || urlParams.get('steer') || '').trim();
    const STEER_DEADZONE_DEG = 1.2;
    const STEER_MAX_ANGLE_DEG = 30.0;

    document.documentElement.classList.add('phone-steer-mode');
    document.title = 'Loop Kicker Journey • Steer';
    const view = document.getElementById('mobilePhoneControllerView');
    if (view) {
        view.classList.remove('hidden');
        view.classList.add('flex');
    }

    const statusEl = document.getElementById('mobileConnStatus');
    const dotEl = document.getElementById('mobileConnDot');
    const enableBtn = document.getElementById('mobileEnableSensorBtn');
    const angleEl = document.getElementById('mobileAngleDisplay');
    const dirEl = document.getElementById('mobileDirectionLabel');
    const barFillEl = document.getElementById('mobileSteerBarFill');
    const sliderEl = document.getElementById('mobileTouchSteerSlider');
    const invertBtn = document.getElementById('mobileInvertToggleBtn');
    const calibrateBtn = document.getElementById('mobileCalibrateBtn');
    const fireBtn = document.getElementById('mobileFireBtn');
    const debugLogEl = document.getElementById('mobileDebugLog');

    const debugLines = [];
    function logDiag(msg) {
        const ts = new Date().toISOString().slice(11, 19);
        debugLines.push(`[${ts}] ${msg}`);
        if (debugLines.length > 35) debugLines.shift();
        if (debugLogEl) {
            debugLogEl.textContent = debugLines.join('\n');
            debugLogEl.scrollTop = debugLogEl.scrollHeight;
        }
    }
    if (debugLogEl) debugLogEl.textContent = '';
    if (Array.isArray(window.__p3dEarlyLogs)) {
        window.__p3dEarlyLogs.forEach((m) => logDiag(m));
    }
    logDiag(`Origin: ${window.location.origin} (HTTPS=${window.isSecureContext})`);
    logDiag(`Target laptop peer: ${hostPeerId || '(none)'}`);

    let conn = null;
    let rawHeadingDeg = null;
    let zeroHeadingDeg = null;
    let smoothedDeltaDeg = null;
    let lockedOrientationEventType = null;
    let currentAngleDeg = 0.0;
    let invertAxis = true;
    let sensorActive = false;
    let isStopped = false;
    let lastSentAt = 0;

    const STEER_SMOOTHING_ALPHA = 0.28;
    const STEER_SPIKE_THRESHOLD_DEG = 10.0;
    const STEER_SPIKE_DAMPING = 0.08;

    function shortestAngleDeltaDeg(current, center) {
        return ((current - center + 540) % 360) - 180;
    }

    function resetCenterCalibration() {
        zeroHeadingDeg = rawHeadingDeg;
        smoothedDeltaDeg = 0.0;
    }

    function updateControllerUiAndSend(angleDeg, forceSend = false) {
        if (isStopped) return;
        currentAngleDeg = Math.max(-45, Math.min(45, angleDeg));
        const effectiveDeg = Math.abs(currentAngleDeg) <= STEER_DEADZONE_DEG ? 0.0 : currentAngleDeg;
        const sign = effectiveDeg > 0 ? '+' : '';
        if (angleEl) angleEl.textContent = `${sign}${effectiveDeg.toFixed(1)}°`;
        if (dirEl) {
            if (effectiveDeg < -1.2) {
                dirEl.textContent = '◀ LEFT';
                dirEl.className = 'text-[11px] font-bold text-cyan-300 uppercase tracking-wider';
            } else if (effectiveDeg > 1.2) {
                dirEl.textContent = 'RIGHT ▶';
                dirEl.className = 'text-[11px] font-bold text-emerald-300 uppercase tracking-wider';
            } else {
                dirEl.textContent = 'CENTERED';
                dirEl.className = 'text-[11px] font-bold text-gray-400 uppercase tracking-wider';
            }
        }
        if (barFillEl) {
            const pct = Math.min(50, (Math.abs(effectiveDeg) / STEER_MAX_ANGLE_DEG) * 50);
            barFillEl.style.width = `${pct}%`;
            barFillEl.style.left = effectiveDeg < 0 ? `${50 - pct}%` : '50%';
        }
        const now = performance.now();
        if (conn && conn.open && (forceSend || now - lastSentAt >= 33)) {
            lastSentAt = now;
            try {
                conn.send({ type: 'steer', angleDeg: +effectiveDeg.toFixed(2) });
            } catch (_) {}
        }
    }

    function handleOrientation(event) {
        if (isStopped) return;
        // Prefer relative 'deviceorientation' (gyroscope) over 'deviceorientationabsolute' (magnetometer)
        // so the two reference frames never fight each other or jump on magnetic interference.
        if (event.type === 'deviceorientation' && typeof event.alpha === 'number' && Number.isFinite(event.alpha)) {
            if (lockedOrientationEventType !== 'deviceorientation') {
                const prevType = lockedOrientationEventType;
                lockedOrientationEventType = 'deviceorientation';
                window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
                if (prevType !== null) {
                    zeroHeadingDeg = null;
                    smoothedDeltaDeg = null;
                }
            }
        } else if (lockedOrientationEventType === 'deviceorientation') {
            return;
        } else if (lockedOrientationEventType === null) {
            lockedOrientationEventType = event.type;
        }

        let heading = null;
        // Prefer gyroscope-integrated event.alpha over webkitCompassHeading (magnetometer)
        if (typeof event.alpha === 'number' && Number.isFinite(event.alpha)) {
            heading = invertAxis ? (360 - event.alpha) % 360 : event.alpha;
        } else if (typeof event.webkitCompassHeading === 'number' && Number.isFinite(event.webkitCompassHeading)) {
            heading = invertAxis ? event.webkitCompassHeading : (360 - event.webkitCompassHeading) % 360;
        }
        if (heading === null) return;
        if (!sensorActive) {
            sensorActive = true;
            logDiag(`Motion sensor active (${lockedOrientationEventType}, heading=${heading.toFixed(1)}°)`);
            if (enableBtn) enableBtn.classList.add('hidden');
        }
        rawHeadingDeg = heading;
        if (zeroHeadingDeg === null) {
            zeroHeadingDeg = heading;
        }
        const rawDelta = shortestAngleDeltaDeg(rawHeadingDeg, zeroHeadingDeg);
        if (smoothedDeltaDeg === null) {
            smoothedDeltaDeg = rawDelta;
        } else {
            const stepDiff = rawDelta - smoothedDeltaDeg;
            const weight = Math.abs(stepDiff) > STEER_SPIKE_THRESHOLD_DEG
                ? STEER_SPIKE_DAMPING
                : STEER_SMOOTHING_ALPHA;
            smoothedDeltaDeg += stepDiff * weight;
        }
        if (sliderEl) sliderEl.value = String(Math.max(-30, Math.min(30, smoothedDeltaDeg)));
        updateControllerUiAndSend(smoothedDeltaDeg);
    }

    async function requestMotionPermissionAndBind() {
        if (!window.isSecureContext || typeof DeviceOrientationEvent === 'undefined') {
            logDiag('Motion sensors unavailable: requires HTTPS secure context');
            if (enableBtn) {
                enableBtn.textContent = 'Sensors Require HTTPS — Use Slider';
                enableBtn.className = 'w-full py-2 px-3 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-xs shrink-0';
            }
            return;
        }
        if (enableBtn) {
            enableBtn.textContent = 'Activating Motion Sensors...';
        }
        try {
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                const res = await DeviceOrientationEvent.requestPermission();
                logDiag(`Motion permission result: ${res}`);
                if (res !== 'granted') {
                    if (enableBtn) {
                        enableBtn.textContent = 'Sensor Permission Denied — Use Slider';
                        enableBtn.className = 'w-full py-2 px-3 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold text-xs shrink-0';
                    }
                    return;
                }
            }
            window.addEventListener('deviceorientationabsolute', handleOrientation, true);
            window.addEventListener('deviceorientation', handleOrientation, true);
            if (enableBtn) {
                enableBtn.textContent = 'Listening for Motion... Tilt Phone';
                enableBtn.className = 'w-full py-2 px-3 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-xs shrink-0';
                setTimeout(() => {
                    if (sensorActive) {
                        enableBtn.classList.add('hidden');
                    } else {
                        logDiag('No orientation events after 1.8s (using slider)');
                        enableBtn.textContent = 'No Gyro Detected — Use Touch Slider';
                        enableBtn.className = 'w-full py-1.5 px-3 rounded-xl bg-gray-900 text-gray-400 border border-gray-800 font-semibold text-[11px] shrink-0';
                    }
                }, 1800);
            }
        } catch (err) {
            logDiag(`Motion sensor error: ${err && (err.message || err)}`);
            if (enableBtn) {
                enableBtn.textContent = 'Sensors Require HTTPS — Use Slider';
                enableBtn.className = 'w-full py-2 px-3 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-xs shrink-0';
            }
        }
    }

    if (enableBtn) {
        if (!window.isSecureContext || typeof DeviceOrientationEvent === 'undefined') {
            enableBtn.textContent = 'Sensors Require HTTPS — Use Slider';
            enableBtn.className = 'w-full py-1.5 px-3 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold text-[11px] shrink-0';
        } else {
            window.addEventListener('deviceorientationabsolute', handleOrientation, true);
            window.addEventListener('deviceorientation', handleOrientation, true);
        }
        enableBtn.addEventListener('click', requestMotionPermissionAndBind);
    }

    if (invertBtn) {
        invertBtn.addEventListener('click', () => {
            invertAxis = !invertAxis;
            resetCenterCalibration();
            invertBtn.textContent = invertAxis ? 'Axis: Normal' : 'Axis: Inverted';
            updateControllerUiAndSend(0, true);
        });
    }

    if (sliderEl) {
        sliderEl.addEventListener('input', (e) => {
            const deg = parseFloat(e.target.value) || 0;
            smoothedDeltaDeg = deg;
            updateControllerUiAndSend(deg, true);
        });
    }

    if (calibrateBtn) {
        calibrateBtn.addEventListener('click', () => {
            resetCenterCalibration();
            if (sliderEl) sliderEl.value = '0';
            updateControllerUiAndSend(0, true);
            if (conn && conn.open) {
                try { conn.send({ type: 'recenter' }); } catch (_) {}
            }
            logDiag('Calibrated center (0°)');
        });
    }

    if (fireBtn) {
        fireBtn.addEventListener('click', () => {
            if (conn && conn.open) {
                try { conn.send({ type: 'fire' }); } catch (_) {}
                logDiag('Sent Fire command');
            } else {
                logDiag('Fire pressed (not connected to laptop)');
            }
        });
    }

    if (!hostPeerId) {
        if (statusEl) {
            statusEl.textContent = 'Demo Mode (Scan Desktop QR to Pair)';
            statusEl.className = 'text-xs font-bold text-cyan-300 truncate';
        }
        if (dotEl) {
            dotEl.className = 'w-2.5 h-2.5 rounded-full bg-cyan-400 shrink-0';
        }
        logDiag('No ?phone-steer=<id> in URL. Running in local demo mode.');
        return;
    }

    function startPeerConnection() {
        if (typeof Peer === 'undefined') {
            if (statusEl) statusEl.textContent = 'PeerJS failed to load';
            logDiag('ERROR: PeerJS library is undefined (CDN blocked)');
            return;
        }

        logDiag('Connecting to PeerJS signaling (0.peerjs.com:443)...');
        const peer = new Peer();
        let retryTimer = null;
        let diagTimeout = null;
        let wasConnected = false;

        function stopControllerOnDisconnect(reason) {
            if (isStopped) return;
            isStopped = true;
            if (retryTimer) {
                clearTimeout(retryTimer);
                retryTimer = null;
            }
            if (diagTimeout) {
                clearTimeout(diagTimeout);
                diagTimeout = null;
            }
            window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
            window.removeEventListener('deviceorientation', handleOrientation, true);
            if (conn) {
                try { conn.close(); } catch (_) {}
                conn = null;
            }
            if (peer && !peer.destroyed) {
                try { peer.destroy(); } catch (_) {}
            }
            logDiag(reason || 'Disconnected by laptop — stopped sending events.');
            if (statusEl) {
                statusEl.textContent = 'Disconnected (Stopped)';
                statusEl.className = 'text-xs font-bold text-rose-400 truncate';
            }
            if (dotEl) {
                dotEl.className = 'w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0';
            }
        }

        function attachPeerConnectionDiagnostics(dc) {
            let boundPc = null;
            const checkPc = setInterval(() => {
                const pc = dc && dc.peerConnection;
                if (!pc || pc === boundPc) return;
                boundPc = pc;
                clearInterval(checkPc);
                logDiag(`RTCPeerConnection created (sig=${pc.signalingState}, ice=${pc.iceConnectionState})`);
                pc.addEventListener('signalingstatechange', () => {
                    logDiag(`SDP signalingState -> ${pc.signalingState}`);
                });
                pc.addEventListener('icegatheringstatechange', () => {
                    logDiag(`ICE gathering -> ${pc.iceGatheringState}`);
                });
                pc.addEventListener('iceconnectionstatechange', () => {
                    logDiag(`ICE connection -> ${pc.iceConnectionState}`);
                    if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
                        if (statusEl) {
                            statusEl.textContent = `ICE ${pc.iceConnectionState} (P2P UDP blocked)`;
                            statusEl.className = 'text-xs font-bold text-rose-400 truncate';
                        }
                        if (dotEl) dotEl.className = 'w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0';
                    }
                });
                pc.addEventListener('connectionstatechange', () => {
                    logDiag(`PeerConnection state -> ${pc.connectionState}`);
                });
                pc.addEventListener('icecandidate', (ev) => {
                    if (ev.candidate && ev.candidate.candidate) {
                        const parts = ev.candidate.candidate.split(' ');
                        const proto = parts[2] || '';
                        const ip = parts[4] || '';
                        const port = parts[5] || '';
                        const typ = parts[7] || '';
                        logDiag(`Local ICE [${typ}] ${proto} ${ip}:${port}`);
                    } else {
                        logDiag('Local ICE gathering finished');
                    }
                });
            }, 50);
            setTimeout(() => clearInterval(checkPc), 5000);
        }

        function connectToHost() {
            if (isStopped || !peer || peer.destroyed || (conn && conn.open)) return;
            logDiag(`Dialing laptop peer "${hostPeerId}"...`);
            conn = peer.connect(hostPeerId, { reliable: false });
            attachPeerConnectionDiagnostics(conn);

            if (diagTimeout) clearTimeout(diagTimeout);
            diagTimeout = setTimeout(() => {
                if (isStopped || (conn && conn.open)) return;
                const pc = conn && conn.peerConnection;
                if (!pc) {
                    logDiag('TIMEOUT (6s): No RTCPeerConnection created.');
                } else if (pc.signalingState === 'have-local-offer') {
                    logDiag('TIMEOUT (6s): Laptop did not answer SDP offer (is laptop QR modal open with matching ID?).');
                } else {
                    logDiag(`TIMEOUT (6s): Laptop answered SDP (sig=${pc.signalingState}), but direct UDP/ICE=${pc.iceConnectionState} failed (NAT/mDNS/firewall between phone & laptop).`);
                }
            }, 6000);

            conn.on('open', () => {
                if (isStopped) {
                    try { conn.close(); } catch (_) {}
                    return;
                }
                wasConnected = true;
                if (retryTimer) {
                    clearTimeout(retryTimer);
                    retryTimer = null;
                }
                if (diagTimeout) {
                    clearTimeout(diagTimeout);
                    diagTimeout = null;
                }
                logDiag('DataChannel OPEN! Connected to laptop.');
                if (statusEl) {
                    statusEl.textContent = 'Connected to Laptop';
                    statusEl.className = 'text-xs font-bold text-emerald-400 truncate';
                }
                if (dotEl) {
                    dotEl.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0';
                }
                updateControllerUiAndSend(currentAngleDeg, true);
            });
            conn.on('data', (msg) => {
                if (msg && msg.type === 'disconnect') {
                    stopControllerOnDisconnect('Laptop disconnected — stopped sending events.');
                    return;
                }
                if (msg && msg.type === 'recenter') {
                    logDiag('Received recenter command from laptop');
                    resetCenterCalibration();
                    if (sliderEl) sliderEl.value = '0';
                    updateControllerUiAndSend(0, true);
                }
            });
            conn.on('close', () => {
                if (isStopped || wasConnected) {
                    stopControllerOnDisconnect('Connection closed by laptop — stopped sending events.');
                    return;
                }
                logDiag('DataChannel closed. Retrying in 4s...');
                if (statusEl) {
                    statusEl.textContent = 'Reconnecting to laptop...';
                    statusEl.className = 'text-xs font-bold text-amber-300 truncate';
                }
                if (dotEl) dotEl.className = 'w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0';
                retryTimer = setTimeout(connectToHost, 4000);
            });
            conn.on('error', (err) => {
                logDiag(`DataChannel error: ${err && (err.message || err.type || err)}`);
            });
        }

        peer.on('open', (myId) => {
            logDiag(`Signaling OK: phone peerId=${myId}`);
            connectToHost();
        });
        peer.on('disconnected', () => {
            logDiag('Signaling disconnected from 0.peerjs.com');
        });
        peer.on('error', (err) => {
            logDiag(`Peer error: type=${err && err.type} msg=${err && err.message}`);
            if (err && err.type === 'peer-unavailable') {
                if (statusEl) {
                    statusEl.textContent = 'Laptop peer not found (check QR)...';
                    statusEl.className = 'text-xs font-bold text-amber-300 truncate';
                }
                if (dotEl) dotEl.className = 'w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0';
                retryTimer = setTimeout(connectToHost, 4000);
            } else {
                if (statusEl) {
                    statusEl.textContent = `Error: ${err.type || 'failed'}`;
                    statusEl.className = 'text-xs font-bold text-rose-400 truncate';
                }
                if (dotEl) dotEl.className = 'w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0';
            }
        });
    }

    if (typeof Peer === 'undefined') {
        logDiag('PeerJS not loaded from unpkg; trying jsdelivr fallback...');
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
        s.onload = () => {
            logDiag('PeerJS fallback loaded.');
            startPeerConnection();
        };
        s.onerror = () => {
            logDiag('ERROR: Failed to load PeerJS from both unpkg and jsdelivr.');
        };
        document.head.appendChild(s);
    } else {
        startPeerConnection();
    }
})();
