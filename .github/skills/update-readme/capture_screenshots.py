#!/usr/bin/env python3
"""
Capture all 12 README.md screenshots for PerFormEd 3D at 1730x1860 (865x930 @ 2x Retina),
covering every screen/state:
- 01-start.png       (Splashscreen: #screenSplash)
- 01-pairing.png     (Step 1 - Pairing & Flight Rules: #screenPairing)
- 01-training.png    (Step 2 - Training Selection: #screenTraining)
- 01-avatar.png      (Step 3 - Avatar Selection: #screenAvatar)
- 02-flight.png .. 05-paramotor.png (In-game Active Flight: #screenGame)
- 06-summary.png     (Post-flight Workout Summary: #summaryModal)

Requirements enforced for all avatar flight screenshots:
- "START FLIGHT" (#avatarStartFlightBtn / #startWorkoutBtn) has been clicked and workout is actively flying
- Forward velocity is temporarily set to zero so no forward movement happens and images are taken before any gate is reached
- "Auto-Fly Target Gate" (#simAutoFollowCheck) is checked
- "Steering" (#steeringToggleCheck) is turned OFF (unchecked -> "Steering: OFF (Auto-Fly Gates)")
"""

import argparse
import base64
import json
import os
import shutil
import socket
import struct
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request
from pathlib import Path


VIEWPORT_WIDTH = 865
VIEWPORT_HEIGHT = 930
DEVICE_SCALE_FACTOR = 2


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def find_browser() -> str:
    for candidate in (
        "google-chrome",
        "google-chrome-stable",
        "chromium",
        "chromium-browser",
    ):
        path = shutil.which(candidate)
        if path:
            return path
    mac_chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    if os.path.isfile(mac_chrome):
        return mac_chrome
    raise RuntimeError("No Chrome/Chromium binary found in PATH.")


class MinimalWebSocket:
    """Zero-dependency RFC 6455 WebSocket client for local Chrome DevTools Protocol."""

    def __init__(self, ws_url: str, timeout: float = 30.0):
        parsed = urllib.parse.urlparse(ws_url)
        host = parsed.hostname or "127.0.0.1"
        port = parsed.port or 80
        path = parsed.path or "/"
        if parsed.query:
            path += "?" + parsed.query

        self.sock = socket.create_connection((host, port), timeout=timeout)
        key = base64.b64encode(os.urandom(16)).decode("ascii")
        handshake = (
            f"GET {path} HTTP/1.1\r\n"
            f"Host: {host}:{port}\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\n\r\n"
        )
        self.sock.sendall(handshake.encode("ascii"))

        response = b""
        while b"\r\n\r\n" not in response:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise RuntimeError("WebSocket handshake failed: connection closed")
            response += chunk
        header_bytes, self._buffer = response.split(b"\r\n\r\n", 1)
        if b"101" not in header_bytes.splitlines()[0]:
            raise RuntimeError(f"WebSocket handshake failed: {header_bytes.decode(errors='replace')}")

    def _recv_exact(self, n: int) -> bytes:
        while len(self._buffer) < n:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise RuntimeError("WebSocket connection closed unexpectedly")
            self._buffer += chunk
        out, self._buffer = self._buffer[:n], self._buffer[n:]
        return out

    def send(self, text: str):
        payload = text.encode("utf-8")
        mask_key = os.urandom(4)
        header = bytearray([0x81])  # FIN + text frame
        length = len(payload)
        if length < 126:
            header.append(0x80 | length)
        elif length < 65536:
            header.append(0x80 | 126)
            header.extend(struct.pack("!H", length))
        else:
            header.append(0x80 | 127)
            header.extend(struct.pack("!Q", length))
        header.extend(mask_key)
        masked = bytes(b ^ mask_key[i % 4] for i, b in enumerate(payload))
        self.sock.sendall(bytes(header) + masked)

    def recv(self) -> str:
        message = bytearray()
        while True:
            b1, b2 = self._recv_exact(2)
            fin = bool(b1 & 0x80)
            opcode = b1 & 0x0F
            masked = bool(b2 & 0x80)
            length = b2 & 0x7F
            if length == 126:
                length = struct.unpack("!H", self._recv_exact(2))[0]
            elif length == 127:
                length = struct.unpack("!Q", self._recv_exact(8))[0]
            mask_key = self._recv_exact(4) if masked else b""
            data = self._recv_exact(length)
            if masked:
                data = bytes(b ^ mask_key[i % 4] for i, b in enumerate(data))
            if opcode == 0x8:  # Close
                raise RuntimeError("WebSocket closed by peer")
            if opcode == 0x9:  # Ping -> Pong
                pong = bytearray([0x8A, 0x80]) + os.urandom(4)
                self.sock.sendall(bytes(pong))
                continue
            if opcode in (0x0, 0x1, 0x2):
                message.extend(data)
                if fin:
                    return message.decode("utf-8")

    def close(self):
        try:
            self.sock.close()
        except Exception:
            pass


class CDPClient:
    def __init__(self, ws_url: str):
        self.ws = MinimalWebSocket(ws_url, timeout=30.0)
        self.msg_id = 0

    def send(self, method: str, params: dict | None = None) -> dict:
        self.msg_id += 1
        call_id = self.msg_id
        payload = {"id": call_id, "method": method, "params": params or {}}
        self.ws.send(json.dumps(payload))
        while True:
            resp = json.loads(self.ws.recv())
            if resp.get("id") == call_id:
                if "error" in resp:
                    raise RuntimeError(f"CDP error in {method}: {resp['error']}")
                return resp.get("result", {})

    def evaluate(self, expression: str):
        res = self.send(
            "Runtime.evaluate",
            {
                "expression": expression,
                "returnByValue": True,
                "awaitPromise": True,
            },
        )
        return res.get("result", {}).get("value")

    def screenshot(self, filepath: Path):
        self.evaluate("typeof window._stepFrame === 'function' ? window._stepFrame() : null")
        res = self.send("Page.captureScreenshot", {"format": "png", "optimizeForSpeed": True})
        data = base64.b64decode(res["data"])
        filepath.write_bytes(data)
        print(f"Saved {filepath} ({len(data)} bytes)")

    def close(self):
        self.ws.close()


def configure_flight_controls(
    cdp: CDPClient,
    *,
    avatar: str,
    camera: str,
    resistance: str,
    ensure_started: bool,
    freeze_forward_velocity: bool = False,
    expected_screen: str | None = None,
):
    js = f"""
    (() => {{
        // 1. Ensure Steering is turned OFF (#steeringToggleCheck unchecked)
        const steering = document.getElementById('steeringToggleCheck');
        if (steering && steering.checked) {{
            steering.checked = false;
            steering.dispatchEvent(new Event('change', {{ bubbles: true }}));
        }}

        // 2. Ensure Auto-Fly Target Gate is checked (#simAutoFollowCheck checked)
        const autoFollow = document.getElementById('simAutoFollowCheck');
        if (autoFollow && !autoFollow.checked) {{
            autoFollow.checked = true;
            autoFollow.dispatchEvent(new Event('change', {{ bubbles: true }}));
        }}

        // 3. Select avatar, camera view, and resistance mode
        const setSelect = (id, val) => {{
            const el = document.getElementById(id);
            if (el && el.value !== val) {{
                el.value = val;
                el.dispatchEvent(new Event('change', {{ bubbles: true }}));
            }}
        }};
        setSelect('avatarSelect', {json.dumps(avatar)});
        setSelect('cameraViewSelect', {json.dumps(camera)});
        setSelect('resistanceModeSelect', {json.dumps(resistance)});

        // 4. Ensure START FLIGHT was clicked when required
        const startBtn = document.getElementById('startWorkoutBtn');
        if ({'true' if ensure_started else 'false'}) {{
            const avatarStartBtn = document.getElementById('avatarStartFlightBtn');
            if (typeof state !== 'undefined' && state.currentScreen === 'avatar' && !state.isRunning && avatarStartBtn) {{
                avatarStartBtn.click();
            }} else {{
                const upperText = (startBtn?.textContent || '').toUpperCase();
                if (startBtn && (upperText.includes('START FLIGHT') || upperText.includes('RESUME FLIGHT'))) {{
                    startBtn.click();
                }}
            }}
        }}

        // Seed live simulator telemetry immediately so short sleep durations still show active watts/cadence/speed
        if (typeof state !== 'undefined' && state.workout) {{
            const targetW = getTargetWattsAtSecond(state.workout, state.elapsedSec, state.ftp);
            if (state.isRunning && state.simMode && state.simAutoJitter) {{
                state.actualWatts = Math.max(0, targetW);
                state.cadence = 88;
                state.speedKmh = estimateSpeedMpsFromWatts(state.actualWatts) * 3.6;
                const slider = document.getElementById('simWattSlider');
                if (slider) slider.value = state.actualWatts;
                const readout = document.getElementById('simWattReadout');
                if (readout) readout.textContent = `${{state.actualWatts}} W`;
            }}
        }}

        // 5. Temporarily set forward velocity to zero so no forward movement happens and no gate is reached
        if (typeof dragon3D !== 'undefined' && dragon3D) {{
            if ({'true' if freeze_forward_velocity else 'false'}) {{
                if (!dragon3D._origUpdateForScreenshots) {{
                    dragon3D._origUpdateForScreenshots = dragon3D.update.bind(dragon3D);
                    dragon3D.update = function(dt) {{
                        if (Math.abs(state.elapsedSec - this.lastSyncedElapsedSec) > 1) {{
                            this.seedInitialGatesAndObstacles(true);
                        }}
                        this.baseElapsedSec = state.elapsedSec;
                        this.lastSyncedElapsedSec = state.elapsedSec;
                        this.subSec = -dt;
                        this.flightZ = 0;
                        try {{
                            return this._origUpdateForScreenshots(dt);
                        }} finally {{
                            this.baseElapsedSec = state.elapsedSec;
                            this.lastSyncedElapsedSec = state.elapsedSec;
                            this.subSec = 0;
                            this.flightZ = 0;
                        }}
                    }};
                }}
                if (typeof fxEngine !== 'undefined' && fxEngine && !fxEngine._origSpawnAccuracyBurst) {{
                    fxEngine._origSpawnAccuracyBurst = fxEngine.spawnAccuracyBurst.bind(fxEngine);
                    fxEngine.spawnAccuracyBurst = function() {{}};
                    fxEngine.particles = [];
                }}
                const fsc = document.getElementById('floatingScoreContainer');
                if (fsc) {{
                    fsc.innerHTML = '';
                    fsc.style.display = 'none';
                }}
                dragon3D.baseElapsedSec = state.elapsedSec;
                dragon3D.lastSyncedElapsedSec = state.elapsedSec;
                dragon3D.subSec = 0;
                dragon3D.flightZ = 0;
            }} else {{
                const fsc = document.getElementById('floatingScoreContainer');
                if (fsc) fsc.style.display = '';
                if (dragon3D._origUpdateForScreenshots) {{
                    dragon3D.update = dragon3D._origUpdateForScreenshots;
                    delete dragon3D._origUpdateForScreenshots;
                }}
                if (typeof fxEngine !== 'undefined' && fxEngine && fxEngine._origSpawnAccuracyBurst) {{
                    fxEngine.spawnAccuracyBurst = fxEngine._origSpawnAccuracyBurst;
                    delete fxEngine._origSpawnAccuracyBurst;
                }}
            }}

            // Snap vertical altitude and camera blend immediately so short sleeps produce fully settled frames
            if (typeof state !== 'undefined' && state.workout) {{
                const targetW = getTargetWattsAtSecond(state.workout, state.elapsedSec, state.ftp);
                const effW = (state.currentScreen === 'avatar' && !state.isRunning && state.actualWatts <= 0)
                    ? targetW
                    : Math.max(0, Number(state.actualWatts) || 0);
                const targetSkyY = wattsToSkyAltitudeY(targetW, state.ftp, state.currentGradientPct);
                const effSkyY = wattsToSkyAltitudeY(effW, state.ftp, state.currentGradientPct);
                dragon3D.dragonCurrentY = effSkyY;
                dragon3D.dragonVelocityY = 0;
                dragon3D.cameraCurrentY = effSkyY + 2.2;
                dragon3D.cameraLookTargetY = targetSkyY * 0.50 + effSkyY * 0.50;
                dragon3D.cameraViewApplied = undefined;
                dragon3D.cameraBlendPos = [0, 0, 0];
                dragon3D.cameraBlendLook = [0, 0, 0];
            }}
        }}

        if (typeof updateLiveHud === 'function') {{
            updateLiveHud();
        }}

        const nearestGateZ = (typeof dragon3D !== 'undefined' && dragon3D && dragon3D.gates && dragon3D.gates.length)
            ? Math.max(...dragon3D.gates.map(g => g.worldZ))
            : null;

        return {{
            currentScreen: typeof state !== 'undefined' ? state.currentScreen : null,
            steeringChecked: steering ? steering.checked : null,
            steeringLabel: document.getElementById('steeringToggleLabel')?.textContent?.trim(),
            autoFollowChecked: autoFollow ? autoFollow.checked : null,
            startBtnText: startBtn ? startBtn.textContent.trim().toUpperCase() : null,
            avatar: document.getElementById('avatarSelect')?.value,
            camera: document.getElementById('cameraViewSelect')?.value,
            resistance: document.getElementById('resistanceModeSelect')?.value,
            flightZ: typeof dragon3D !== 'undefined' && dragon3D ? dragon3D.flightZ : null,
            nearestGateZ,
            gatesPassedCount: typeof state !== 'undefined' ? state.gatesPassedCount : null,
        }};
    }})()
    """
    state = cdp.evaluate(js)
    print("  State:", json.dumps(state))
    if expected_screen is not None and state.get("currentScreen") != expected_screen:
        raise RuntimeError(f"Expected currentScreen={expected_screen!r}, got {state}")
    if state.get("steeringChecked") is not False:
        raise RuntimeError(f"Expected steeringChecked=False, got {state}")
    if state.get("autoFollowChecked") is not True:
        raise RuntimeError(f"Expected autoFollowChecked=True, got {state}")
    if ensure_started and state.get("startBtnText") != "PAUSE FLIGHT":
        raise RuntimeError(f"Expected active flight ('PAUSE FLIGHT'), got {state}")
    if freeze_forward_velocity:
        if state.get("flightZ") != 0:
            raise RuntimeError(f"Expected flightZ=0 (zero forward velocity), got {state}")
        if state.get("gatesPassedCount") != 0:
            raise RuntimeError(f"Expected gatesPassedCount=0 (before any gate is reached), got {state}")


def main():
    repo_root = Path(__file__).resolve().parents[3]
    parser = argparse.ArgumentParser(description="Capture PerFormEd 3D documentation screenshots.")
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=repo_root / "docs" / "screenshots",
        help="Output directory for captured PNG files (default: docs/screenshots).",
    )
    args = parser.parse_args()

    html_path = repo_root / "performed3d.html"
    out_dir = args.out_dir.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    if not html_path.is_file():
        raise FileNotFoundError(f"Cannot find {html_path}")

    port = find_free_port()
    browser = find_browser()
    user_data_dir = tempfile.mkdtemp(prefix="performed3d_chrome_")

    cmd = [
        browser,
        "--headless=new",
        f"--remote-debugging-port={port}",
        "--remote-allow-origins=*",
        f"--user-data-dir={user_data_dir}",
        "--no-first-run",
        "--no-default-browser-check",
        "--mute-audio",
        "--disable-gpu-sandbox",
        "--enable-webgl",
        "--ignore-gpu-blocklist",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        f"--window-size={VIEWPORT_WIDTH},{VIEWPORT_HEIGHT}",
        "--hide-scrollbars",
        f"file://{html_path}",
    ]

    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    cdp = None
    try:
        # Wait for DevTools target with short polling interval
        targets = None
        for _ in range(100):
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/json") as resp:
                    targets = json.loads(resp.read().decode())
                    if targets:
                        break
            except Exception:
                time.sleep(0.05)
        if not targets:
            raise RuntimeError("Failed to connect to headless Chrome DevTools.")

        page_target = next((t for t in targets if t.get("type") == "page"), targets[0])
        cdp = CDPClient(page_target["webSocketDebuggerUrl"])
        cdp.send("Page.enable")
        cdp.send("Runtime.enable")
        cdp.send(
            "Emulation.setDeviceMetricsOverride",
            {
                "width": VIEWPORT_WIDTH,
                "height": VIEWPORT_HEIGHT,
                "deviceScaleFactor": DEVICE_SCALE_FACTOR,
                "mobile": False,
            },
        )

        # Poll until document & Three.js scene are initialized instead of sleeping for multiple seconds
        ready = False
        for _ in range(100):
            ready = bool(
                cdp.evaluate(
                    "document.readyState === 'complete' && typeof dragon3D !== 'undefined' && dragon3D !== null && !!dragon3D.renderer"
                )
            )
            if ready:
                break
            time.sleep(0.05)
        if not ready:
            raise RuntimeError("Timed out waiting for Three.js dragon3D scene to initialize.")

        # Pause continuous SwiftShader requestAnimationFrame spinning and step frames cleanly on demand
        cdp.evaluate(
            """
            (() => {
                if (!window._origRAF) {
                    window._origRAF = window.requestAnimationFrame.bind(window);
                    window._pendingRenderLoop = null;
                    window.requestAnimationFrame = function(cb) {
                        if (cb && cb.name === 'renderLoop') {
                            window._pendingRenderLoop = cb;
                            return 0;
                        }
                        return window._origRAF(cb);
                    };
                    window._stepFrame = () => new Promise((resolve) => {
                        window._origRAF((now) => {
                            if (typeof updateLiveHud === 'function') {
                                updateLiveHud();
                            }
                            if (window._pendingRenderLoop) {
                                const fn = window._pendingRenderLoop;
                                window._pendingRenderLoop = null;
                                fn(now);
                            } else if (typeof dragon3D !== 'undefined' && dragon3D) {
                                dragon3D.update(0.016);
                            }
                            if (typeof dragon3D !== 'undefined' && dragon3D && dragon3D._origUpdateForScreenshots) {
                                const fsc = document.getElementById('floatingScoreContainer');
                                if (fsc) fsc.innerHTML = '';
                            }
                            window._origRAF(() => resolve(true));
                        });
                    });
                }
            })()
            """
        )
        time.sleep(0.05)

        # 1. 01-start.png: Splashscreen (#screenSplash)
        print("Capturing 01-start.png (splashscreen)...")
        configure_flight_controls(
            cdp,
            avatar="aero_wyvern",
            camera="1",
            resistance="easy",
            ensure_started=False,
            expected_screen="splash",
        )
        time.sleep(0.05)
        cdp.screenshot(out_dir / "01-start.png")

        # 2. 01-pairing.png: Step 1 — Pair Devices & Flight Rules (#screenPairing)
        print("Capturing 01-pairing.png (pairing screen)...")
        cdp.evaluate("document.getElementById('splashStartBtn')?.click()")
        configure_flight_controls(
            cdp,
            avatar="aero_wyvern",
            camera="1",
            resistance="easy",
            ensure_started=False,
            expected_screen="pairing",
        )
        time.sleep(0.05)
        cdp.screenshot(out_dir / "01-pairing.png")

        # 3. 01-training.png: Step 2 — Select Training Workout (#screenTraining)
        print("Capturing 01-training.png (training selection screen)...")
        cdp.evaluate("document.getElementById('toTrainingScreenBtn')?.click()")
        configure_flight_controls(
            cdp,
            avatar="aero_wyvern",
            camera="1",
            resistance="easy",
            ensure_started=False,
            expected_screen="training",
        )
        time.sleep(0.05)
        cdp.screenshot(out_dir / "01-training.png")

        # 4. 01-avatar.png: Step 3 — Choose Your 3D Flying Avatar (#screenAvatar)
        print("Capturing 01-avatar.png (avatar selection screen)...")
        cdp.evaluate("document.getElementById('toAvatarScreenBtn')?.click()")
        configure_flight_controls(
            cdp,
            avatar="aero_wyvern",
            camera="1",
            resistance="easy",
            ensure_started=False,
            expected_screen="avatar",
        )
        time.sleep(0.05)
        cdp.screenshot(out_dir / "01-avatar.png")

        # 5. 02-flight.png: Active flight (#screenGame), zero forward velocity (before any gate is reached), Auto-Fly Target Gate checked, Steering OFF
        print("Capturing 02-flight.png...")
        configure_flight_controls(
            cdp,
            avatar="aero_wyvern",
            camera="1",
            resistance="easy",
            ensure_started=True,
            freeze_forward_velocity=True,
            expected_screen="game",
        )
        time.sleep(0.05)
        cdp.screenshot(out_dir / "02-flight.png")

        # 6. 03-delorean.png: Active flight, zero forward velocity, advance to higher-watt segment, DeLorean, Chase cam
        print("Capturing 03-delorean.png...")
        cdp.evaluate(
            """
            (() => {
                if (typeof state !== 'undefined' && state.workout) {
                    for (let i = 0; i < 2; i++) {
                        const seg = getActiveSegmentAtSecond(state.workout, state.elapsedSec);
                        if (seg && seg.endSec < state.workout.totalDuration) {
                            state.elapsedSec = seg.endSec;
                            syncGradientAtSecond(state.elapsedSec);
                        }
                    }
                    if (state.simMode && state.simAutoJitter) {
                        const targetW = getTargetWattsAtSecond(state.workout, state.elapsedSec, state.ftp);
                        state.actualWatts = targetW;
                        document.getElementById('simWattSlider').value = targetW;
                        document.getElementById('simWattReadout').textContent = `${targetW} W`;
                    }
                    if (typeof dragon3D !== 'undefined' && dragon3D) {
                        dragon3D.seedInitialGatesAndObstacles(true);
                    }
                    updateLiveHud();
                }
            })()
            """
        )
        configure_flight_controls(
            cdp,
            avatar="delorean",
            camera="1",
            resistance="medium",
            ensure_started=True,
            freeze_forward_velocity=True,
            expected_screen="game",
        )
        time.sleep(0.05)
        cdp.screenshot(out_dir / "03-delorean.png")

        # 7. 04-ufo.png: Active flight, zero forward velocity, Mars Attacks UFO, Chase cam
        print("Capturing 04-ufo.png...")
        configure_flight_controls(
            cdp,
            avatar="mars_ufo",
            camera="1",
            resistance="medium",
            ensure_started=True,
            freeze_forward_velocity=True,
            expected_screen="game",
        )
        time.sleep(0.05)
        cdp.screenshot(out_dir / "04-ufo.png")

        # 8. 04-ufo-topdown.png: Active flight, zero forward velocity, Mars Attacks UFO, Top-Down cam (3)
        print("Capturing 04-ufo-topdown.png...")
        configure_flight_controls(
            cdp,
            avatar="mars_ufo",
            camera="3",
            resistance="medium",
            ensure_started=True,
            freeze_forward_velocity=True,
            expected_screen="game",
        )
        time.sleep(0.05)
        cdp.screenshot(out_dir / "04-ufo-topdown.png")

        # 9. 05-front.png: Active flight, zero forward velocity, Sky Dragon (Wyvern), Front cam (4)
        print("Capturing 05-front.png...")
        configure_flight_controls(
            cdp,
            avatar="aero_wyvern",
            camera="4",
            resistance="easy",
            ensure_started=True,
            freeze_forward_velocity=True,
            expected_screen="game",
        )
        time.sleep(0.05)
        cdp.screenshot(out_dir / "05-front.png")

        # 10. 05-fuchur.png: Active flight, zero forward velocity, Fuchur (Luckdragon), Chase cam (1)
        print("Capturing 05-fuchur.png...")
        configure_flight_controls(
            cdp,
            avatar="fuchur",
            camera="1",
            resistance="easy",
            ensure_started=True,
            freeze_forward_velocity=True,
            expected_screen="game",
        )
        time.sleep(0.05)
        cdp.screenshot(out_dir / "05-fuchur.png")

        # 11. 05-paramotor.png: Active flight, zero forward velocity, Paramotor (Phi Maestro Light 3), Chase cam (1)
        print("Capturing 05-paramotor.png...")
        configure_flight_controls(
            cdp,
            avatar="paramotor",
            camera="1",
            resistance="easy",
            ensure_started=True,
            freeze_forward_velocity=True,
            expected_screen="game",
        )
        time.sleep(0.05)
        cdp.screenshot(out_dir / "05-paramotor.png")

        # Restore normal forward velocity and record representative workout samples before finishing
        configure_flight_controls(
            cdp,
            avatar="paramotor",
            camera="1",
            resistance="easy",
            ensure_started=True,
            freeze_forward_velocity=False,
            expected_screen="game",
        )
        cdp.evaluate(
            """
            (() => {
                if (typeof executeWorkoutTick === 'function' && typeof state !== 'undefined') {
                    while (state.isRunning && state.samples.length < 16) {
                        executeWorkoutTick();
                    }
                }
            })()
            """
        )

        # 12. 06-summary.png: Click Finish (#finishWorkoutBtn) after active flight (#summaryModal)
        print("Capturing 06-summary.png (summary screen)...")
        cdp.evaluate("document.getElementById('finishWorkoutBtn')?.click()")
        time.sleep(0.05)
        summary_screen = cdp.evaluate("typeof state !== 'undefined' ? state.currentScreen : null")
        if summary_screen != "summary":
            raise RuntimeError(f"Expected currentScreen='summary', got {summary_screen!r}")
        cdp.screenshot(out_dir / "06-summary.png")

        print("All 12 screenshots captured successfully.")
    finally:
        if cdp is not None:
            try:
                cdp.close()
            except Exception:
                pass
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()
        shutil.rmtree(user_data_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
