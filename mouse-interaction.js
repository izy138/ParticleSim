// Mouse Interaction System for Particle Life Simulator

class MouseInteraction {
    constructor(canvasId) {
        this.canvasId = canvasId;
        this.canvas = document.getElementById(canvasId);
        this.mousePos = { x: 0, y: 0 };
        this.isEnabled = false;
        this.forceStrength = 50.0;
        this.forceRadius = 0.3;
        this.isAttract = true;

        this.setupEventListeners();
    }

    setupEventListeners() {
        if (!this.canvas) return;

        this.canvas.addEventListener('mousemove', (event) => {
            this.updateMousePosition(event);
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.isEnabled = false;
        });

        this.canvas.addEventListener('mouseenter', () => {
            const checkbox = document.getElementById('mouse-interaction-checkbox');
            if (checkbox && checkbox.checked) {
                this.isEnabled = true;
            }
        });

        this.canvas.addEventListener('click', () => {
            if (this.isEnabled) {
                this.isAttract = !this.isAttract;
                this.showForceTypeIndicator();
            }
        });
    }

    updateMousePosition(event) {
        if (!this.canvas) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        this.mousePos.x = (x / this.canvas.clientWidth) * 2 - 1;
        this.mousePos.y = -((y / this.canvas.clientHeight) * 2 - 1);
    }

    getMouseData() {
        return {
            x: this.mousePos.x,
            y: this.mousePos.y,
            enabled: this.isEnabled ? 1.0 : 0.0,
            strength: this.isAttract ? this.forceStrength : -this.forceStrength,
            radius: this.forceRadius
        };
    }

    setEnabled(enabled) {
        this.isEnabled = enabled;
    }

    setForceStrength(strength) {
        this.forceStrength = Math.abs(strength);
    }

    setForceRadius(radius) {
        this.forceRadius = Math.max(0.1, Math.min(1.0, radius));
    }

    toggleForceType() {
        this.isAttract = !this.isAttract;
        this.showForceTypeIndicator();
    }

    showForceTypeIndicator() {
        const indicator = document.createElement('div');
        indicator.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            padding: 10px 20px;
            background: ${this.isAttract ? '#4CAF50' : '#F44336'};
            color: white;
            border-radius: 20px;
            font-weight: bold;
            z-index: 1000;
            pointer-events: none;
            opacity: 0.9;
            transition: opacity 0.3s;
        `;
        indicator.textContent = this.isAttract ? '🧲 Attract Mode' : '💥 Repel Mode';
        document.body.appendChild(indicator);

        setTimeout(() => {
            indicator.style.opacity = '0';
            setTimeout(() => indicator.remove(), 300);
        }, 1000);
    }
}

window.MouseInteraction = MouseInteraction;