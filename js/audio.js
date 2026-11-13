        // =========================================================================
        // 3. WEB AUDIO ARCADE SYNTHESIZER
        // =========================================================================
        class ArcadeSoundEngine {
            constructor() {
                this.enabled = true;
                this.ctx = null;
            }
            init() {
                if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
                    const AudioCtx = window.AudioContext || window.webkitAudioContext;
                    this.ctx = new AudioCtx();
                }
                if (this.ctx && this.ctx.state === 'suspended') {
                    this.ctx.resume();
                }
            }
            playTone(freq, durationMs, type = 'sine', gainVal = 0.06) {
                if (!this.enabled) return;
                try {
                    this.init();
                    if (!this.ctx) return;
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = type;
                    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
                    gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + durationMs / 1000);
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start();
                    osc.stop(this.ctx.currentTime + durationMs / 1000);
                } catch (_) {}
            }
            playPointTick(accuracyRatio, combo) {
                const baseFreq = 520 + Math.round(accuracyRatio * 260) + Math.min(200, combo * 25);
                this.playTone(baseFreq, 95, 'triangle', 0.045);
            }
            playComboUp() {
                this.playTone(587.33, 90, 'sine', 0.07);
                setTimeout(() => this.playTone(880, 160, 'triangle', 0.08), 80);
            }
            playRingStreakBonus(tier) {
                // Higher tiers play a longer, higher-reaching arpeggio
                const scale = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093.00];
                const noteCount = Math.min(scale.length, 3 + tier);
                for (let i = 0; i < noteCount; i++) {
                    setTimeout(() => {
                        this.playTone(scale[i], 140, 'square', 0.05);
                        this.playTone(scale[i] * 1.5, 140, 'triangle', 0.04);
                    }, i * 75);
                }
                setTimeout(() => this.playTone(scale[noteCount - 1] * 2, 420, 'triangle', 0.07), noteCount * 75);
            }
            playDragonFireBlast() {
                this.playTone(320, 110, 'sawtooth', 0.08);
                setTimeout(() => this.playTone(680, 130, 'triangle', 0.09), 50);
            }
            playObstacleHitPenalty() {
                this.playTone(135, 220, 'sawtooth', 0.11);
                setTimeout(() => this.playTone(98, 280, 'square', 0.10), 90);
            }
            playFinishFanfare() {
                const notes = [523.25, 659.25, 783.99, 1046.50];
                notes.forEach((n, idx) => {
                    setTimeout(() => this.playTone(n, 220, 'triangle', 0.09), idx * 110);
                });
            }
        }

        // =========================================================================
        // 3b. ADAPTIVE PROCEDURAL MUSIC (driven by upcoming ring target watts relative to FTP)
        // =========================================================================
        // Relaxed riding (warm-up / cool-down) → slow, warm major-key pads and bells.
        // Threshold and above → faster tempo, minor key, driving drums, saw bass and bright 16th arps.
        const MUSIC_ZONES = [
            { name: 'Drift',     minIntensity: 0.00, bpm: 76  },
            { name: 'Cruise',    minIntensity: 0.35, bpm: 92  },
            { name: 'Groove',    minIntensity: 0.68, bpm: 112 },
            { name: 'Drive',     minIntensity: 0.90, bpm: 128 },
            { name: 'Inferno',   minIntensity: 1.06, bpm: 146 }
        ];
        const MUSIC_ZONE_HYSTERESIS = 0.03;
        const MUSIC_INTENSITY_SMOOTHING_SEC = 1.6;
        const MUSIC_MASTER_VOLUME = 0.2;

        // Chord voicings as MIDI notes; bass roots are separate for a clean low end.
        const MUSIC_PROGRESSIONS = {
            relaxed: [
                { bass: 36, notes: [60, 64, 67, 71] }, // Cmaj7
                { bass: 33, notes: [57, 60, 64, 67] }, // Am7
                { bass: 41, notes: [53, 57, 60, 64] }, // Fmaj7
                { bass: 43, notes: [55, 59, 62, 64] }  // G6
            ],
            intense: [
                { bass: 33, notes: [57, 60, 64, 69] }, // Am
                { bass: 41, notes: [57, 60, 65, 69] }, // F
                { bass: 36, notes: [55, 60, 64, 67] }, // C
                { bass: 43, notes: [55, 59, 62, 67] }  // G
            ]
        };

        class AdaptiveMusicEngine {
            constructor(sfxEngine) {
                this.sfx = sfxEngine;
                this.enabled = true;
                this.playing = false;
                this.intensity = 0.5;
                this.zone = 1;
                this.barZone = 1;
                this.prevBarZone = 1;
                this.bpm = MUSIC_ZONES[1].bpm;
                this.step = 0;
                this.nextStepTime = 0;
                this.timer = null;
                this.lastUpdateMs = 0;
                this.graphCtx = null;
                this.onZoneChange = null;
            }

            static midiToFreq(m) {
                return 440 * Math.pow(2, (m - 69) / 12);
            }

            get zoneName() {
                return MUSIC_ZONES[this.zone].name;
            }

            ensureGraph() {
                const ctx = this.sfx.ctx;
                if (!ctx) return false;
                if (this.graphCtx === ctx) return true;
                this.graphCtx = ctx;

                this.compressor = ctx.createDynamicsCompressor();
                this.compressor.threshold.value = -18;
                this.compressor.ratio.value = 4;
                this.compressor.connect(ctx.destination);

                this.master = ctx.createGain();
                this.master.gain.value = 0;
                this.master.connect(this.compressor);

                this.drumBus = ctx.createGain();
                this.drumBus.gain.value = 1;
                this.drumBus.connect(this.master);

                this.synthFilter = ctx.createBiquadFilter();
                this.synthFilter.type = 'lowpass';
                this.synthFilter.frequency.value = 1200;
                this.synthFilter.Q.value = 0.7;
                this.synthFilter.connect(this.master);

                const len = ctx.sampleRate;
                this.noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
                const data = this.noiseBuffer.getChannelData(0);
                for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
                return true;
            }

            setEnabled(enabled) {
                this.enabled = !!enabled;
                if (!this.enabled) this.stop();
            }

            // Called every animation frame with the target watts of the next ring ahead.
            update(watts, ftp, running) {
                const nowMs = performance.now();
                const dt = this.lastUpdateMs ? Math.min(0.5, (nowMs - this.lastUpdateMs) / 1000) : 0;
                this.lastUpdateMs = nowMs;

                const target = ftp > 0 ? Math.max(0, Number(watts) || 0) / ftp : 0;
                const k = 1 - Math.exp(-dt / MUSIC_INTENSITY_SMOOTHING_SEC);
                this.intensity += (target - this.intensity) * k;
                this.updateZone();

                const shouldPlay = this.enabled && this.sfx.enabled && running;
                if (shouldPlay && !this.playing) this.start();
                else if (!shouldPlay && this.playing) this.stop();
                if (!this.playing) return;

                const zoneBpm = MUSIC_ZONES[this.zone].bpm;
                this.bpm += (zoneBpm - this.bpm) * Math.min(1, dt * 0.8);

                const norm = Math.min(1, Math.max(0, (this.intensity - 0.3) / 0.9));
                const cutoff = 650 + Math.pow(norm, 1.6) * 7500;
                this.synthFilter.frequency.setTargetAtTime(cutoff, this.graphCtx.currentTime, 0.25);
            }

            updateZone() {
                let z = this.zone;
                while (z < MUSIC_ZONES.length - 1 && this.intensity >= MUSIC_ZONES[z + 1].minIntensity + MUSIC_ZONE_HYSTERESIS) z++;
                while (z > 0 && this.intensity < MUSIC_ZONES[z].minIntensity - MUSIC_ZONE_HYSTERESIS) z--;
                if (z !== this.zone) {
                    this.zone = z;
                    if (this.onZoneChange) this.onZoneChange(MUSIC_ZONES[z].name, z);
                }
            }

            start() {
                this.sfx.init();
                if (!this.ensureGraph()) return;
                const ctx = this.graphCtx;
                this.playing = true;
                this.step = 0;
                this.barZone = this.prevBarZone = this.zone;
                this.bpm = MUSIC_ZONES[this.zone].bpm;
                this.nextStepTime = ctx.currentTime + 0.08;
                this.master.gain.cancelScheduledValues(ctx.currentTime);
                this.master.gain.setTargetAtTime(MUSIC_MASTER_VOLUME, ctx.currentTime, 0.4);
                clearInterval(this.timer);
                this.timer = setInterval(() => this.scheduler(), 25);
            }

            stop() {
                this.playing = false;
                clearInterval(this.timer);
                this.timer = null;
                if (this.graphCtx && this.master) {
                    const t = this.graphCtx.currentTime;
                    this.master.gain.cancelScheduledValues(t);
                    this.master.gain.setTargetAtTime(0, t, 0.25);
                }
            }

            scheduler() {
                const ctx = this.graphCtx;
                if (!ctx || !this.playing) return;
                if (this.nextStepTime < ctx.currentTime - 0.25) {
                    // Tab was throttled; resync instead of firing a burst of stale notes.
                    this.nextStepTime = ctx.currentTime + 0.05;
                }
                while (this.nextStepTime < ctx.currentTime + 0.15) {
                    this.scheduleStep(this.step, this.nextStepTime);
                    this.nextStepTime += 60 / this.bpm / 4;
                    this.step++;
                }
            }

            scheduleStep(step, t) {
                const s = step % 16;
                const bar = Math.floor(step / 16);
                if (s === 0) {
                    this.prevBarZone = this.barZone;
                    this.barZone = this.zone;
                }
                const z = this.barZone;
                const stepDur = 60 / this.bpm / 4;
                const barDur = stepDur * 16;

                const prog = z >= 3 ? MUSIC_PROGRESSIONS.intense : MUSIC_PROGRESSIONS.relaxed;
                const chordBars = z <= 1 ? 2 : 1;
                const chord = prog[Math.floor(bar / chordBars) % prog.length];
                const isChordStart = s === 0 && bar % chordBars === 0;

                if (s === 0 && z > this.prevBarZone && z >= 2) this.crash(t, 0.22 + 0.06 * z);

                // Pads
                if (isChordStart) {
                    const padType = z >= 3 ? 'sawtooth' : (z >= 2 ? 'triangle' : 'sine');
                    const padGain = z >= 3 ? 0.028 : 0.05;
                    const len = barDur * chordBars;
                    chord.notes.forEach((n) => {
                        this.pad(AdaptiveMusicEngine.midiToFreq(n), t, len, padType, padGain, z <= 1 ? len * 0.35 : 0.08);
                    });
                }

                // Drums
                if (z === 1 && (s === 0 || s === 10)) this.kick(t, 0.45);
                if (z === 2 && (s === 0 || s === 6 || s === 8)) this.kick(t, 0.7);
                if (z >= 3 && s % 4 === 0) this.kick(t, z === 4 ? 1.0 : 0.85);
                if (z === 4 && s === 14 && bar % 2 === 1) this.kick(t, 0.6);

                if (z === 2 && (s === 4 || s === 12)) this.snare(t, 0.12, true);
                if (z >= 3 && (s === 4 || s === 12)) this.snare(t, z === 4 ? 0.36 : 0.28, false);
                if (z === 4 && bar % 4 === 3 && s >= 12) this.snare(t, 0.1 + (s - 12) * 0.05, false);

                if (z === 1 && s % 4 === 2) this.hat(t, 0.025, 0.03);
                if (z === 2 && s % 4 === 2) this.hat(t, 0.06, 0.04);
                if (z >= 3) this.hat(t, s % 4 === 2 ? 0.08 : 0.035, 0.03);
                if (z === 4 && s % 4 === 2) this.hat(t, 0.05, 0.18);

                // Bass
                const root = AdaptiveMusicEngine.midiToFreq(chord.bass);
                if (z === 1 && isChordStart) this.bass(root, t, barDur * 2, 'sine', 0.22, 300);
                if (z === 2 && [0, 3, 6, 8, 11, 14].includes(s)) this.bass(root, t, stepDur * 1.6, 'triangle', 0.26, 900);
                if (z === 3 && s % 2 === 0) this.bass(s % 4 === 2 ? root * 2 : root, t, stepDur * 1.5, 'sawtooth', 0.18, 1400);
                if (z === 4) this.bass(s % 2 === 1 ? root * 2 : root, t, stepDur * 0.9, 'sawtooth', 0.2, 2400);

                // Melodic layer: bells → arp → driving 16th lead
                const tones = [...chord.notes, chord.notes[0] + 12];
                if (z === 0 && (s === 0 || s === 7 || s === 10) && (s === 0 || Math.random() < 0.6)) {
                    const n = tones[Math.floor(Math.random() * tones.length)] + 12;
                    this.pluck(AdaptiveMusicEngine.midiToFreq(n), t, 1.8, 'sine', 0.05);
                }
                if (z === 1 && s % 4 === 0) {
                    this.pluck(AdaptiveMusicEngine.midiToFreq(tones[(s / 4 + bar) % tones.length] + 12), t, 0.9, 'sine', 0.045);
                }
                if (z === 2 && s % 2 === 0) {
                    this.pluck(AdaptiveMusicEngine.midiToFreq(tones[(s / 2) % tones.length] + 12), t, 0.3, 'triangle', 0.045);
                }
                if (z === 3) {
                    const pattern = [0, 2, 4, 2, 1, 3, 4, 3];
                    this.pluck(AdaptiveMusicEngine.midiToFreq(tones[pattern[s % 8]] + 12), t, 0.16, 'square', 0.022);
                }
                if (z === 4) {
                    const pattern = [0, 4, 2, 4, 1, 4, 3, 4, 0, 4, 2, 4, 3, 2, 1, 4];
                    const f = AdaptiveMusicEngine.midiToFreq(tones[pattern[s]] + 12);
                    this.pluck(f, t, 0.14, 'sawtooth', 0.026);
                    if (s % 4 === 0) this.pluck(f * 2, t, 0.12, 'square', 0.012);
                }
            }

            envGain(t, peak, attack, end) {
                const g = this.graphCtx.createGain();
                g.gain.setValueAtTime(0.0001, t);
                g.gain.linearRampToValueAtTime(peak, t + attack);
                g.gain.exponentialRampToValueAtTime(0.0001, end);
                return g;
            }

            pad(freq, t, len, type, gain, attack) {
                const ctx = this.graphCtx;
                const g = ctx.createGain();
                g.gain.setValueAtTime(0.0001, t);
                g.gain.linearRampToValueAtTime(gain, t + attack);
                g.gain.setValueAtTime(gain, t + Math.max(attack, len - 0.3));
                g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.6);
                g.connect(this.synthFilter);
                [-7, 7].forEach((detune) => {
                    const o = ctx.createOscillator();
                    o.type = type;
                    o.frequency.value = freq;
                    o.detune.value = detune;
                    o.connect(g);
                    o.start(t);
                    o.stop(t + len + 0.7);
                });
            }

            pluck(freq, t, decay, type, gain) {
                const ctx = this.graphCtx;
                const o = ctx.createOscillator();
                o.type = type;
                o.frequency.value = freq;
                const g = this.envGain(t, gain, 0.005, t + decay);
                o.connect(g);
                g.connect(this.synthFilter);
                o.start(t);
                o.stop(t + decay + 0.05);
            }

            bass(freq, t, len, type, gain, filterPeak) {
                const ctx = this.graphCtx;
                const o = ctx.createOscillator();
                o.type = type;
                o.frequency.value = freq;
                const f = ctx.createBiquadFilter();
                f.type = 'lowpass';
                f.Q.value = 4;
                f.frequency.setValueAtTime(filterPeak, t);
                f.frequency.exponentialRampToValueAtTime(Math.max(120, filterPeak * 0.25), t + len);
                const g = this.envGain(t, gain, 0.008, t + len);
                o.connect(f);
                f.connect(g);
                g.connect(this.master);
                o.start(t);
                o.stop(t + len + 0.05);
            }

            kick(t, gain) {
                const ctx = this.graphCtx;
                const o = ctx.createOscillator();
                o.type = 'sine';
                o.frequency.setValueAtTime(150, t);
                o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
                const g = this.envGain(t, gain, 0.002, t + 0.38);
                o.connect(g);
                g.connect(this.drumBus);
                o.start(t);
                o.stop(t + 0.42);
            }

            noise(t, len, filterType, filterFreq, gain, q = 0.8) {
                const ctx = this.graphCtx;
                const src = ctx.createBufferSource();
                src.buffer = this.noiseBuffer;
                src.loop = true;
                const f = ctx.createBiquadFilter();
                f.type = filterType;
                f.frequency.value = filterFreq;
                f.Q.value = q;
                const g = this.envGain(t, gain, 0.002, t + len);
                src.connect(f);
                f.connect(g);
                g.connect(this.drumBus);
                src.start(t, Math.random() * 0.5);
                src.stop(t + len + 0.05);
            }

            hat(t, gain, len) {
                this.noise(t, len, 'highpass', 7500, gain);
            }

            snare(t, gain, rim) {
                if (rim) {
                    this.noise(t, 0.05, 'bandpass', 3200, gain, 2);
                    return;
                }
                this.noise(t, 0.18, 'bandpass', 1800, gain);
                const ctx = this.graphCtx;
                const o = ctx.createOscillator();
                o.type = 'triangle';
                o.frequency.setValueAtTime(200, t);
                o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
                const g = this.envGain(t, gain * 0.6, 0.002, t + 0.1);
                o.connect(g);
                g.connect(this.drumBus);
                o.start(t);
                o.stop(t + 0.12);
            }

            crash(t, gain) {
                this.noise(t, 1.4, 'highpass', 5000, gain, 0.5);
            }
        }

