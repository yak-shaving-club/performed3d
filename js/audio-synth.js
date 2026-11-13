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
