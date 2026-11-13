// =========================================================================
// 5. PARTICLE & GRAPHICAL EFFECTS ENGINE
// =========================================================================
class VisualEffectsEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.shockwaves = [];
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    spawnAccuracyBurst(x, y, accuracyRatio, isBullseye) {
        const count = isBullseye ? 32 : Math.round(12 + accuracyRatio * 14);
        const colors = isBullseye
            ? ['#fde047', '#facc15', '#4ade80', '#38bdf8', '#f97316']
            : ['#4ade80', '#2dd4bf', '#34d399', '#a7f3d0'];

        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
            const speed = (isBullseye ? 3.5 : 2.0) + Math.random() * 5.5;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1.2,
                radius: (isBullseye ? 3.5 : 2.5) + Math.random() * 3,
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: 1.0,
                decay: 0.016 + Math.random() * 0.015
            });
        }

        if (isBullseye) {
            this.shockwaves.push({
                x, y,
                radius: 20,
                maxRadius: 210,
                alpha: 0.75,
                color: '#facc15'
            });
        }
    }

    updateAndDraw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
            const sw = this.shockwaves[i];
            sw.radius += 6.5;
            sw.alpha *= 0.93;
            if (sw.alpha <= 0.03 || sw.radius >= sw.maxRadius) {
                this.shockwaves.splice(i, 1);
                continue;
            }
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
            this.ctx.strokeStyle = sw.color;
            this.ctx.globalAlpha = sw.alpha;
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
            this.ctx.restore();
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.12;
            p.alpha -= p.decay;
            if (p.alpha <= 0) {
                this.particles.splice(i, 1);
                continue;
            }
            this.ctx.save();
            this.ctx.globalAlpha = p.alpha;
            this.ctx.fillStyle = p.color;
            this.ctx.shadowColor = p.color;
            this.ctx.shadowBlur = 10;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        }
    }
}
