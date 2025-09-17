// Mouse Interaction System for Particle Life Simulator

class MouseInteraction {
    constructor(canvasId) {
        this.canvasId = canvasId;
        this.canvas = document.getElementById(canvasId);
        this.mousePos = { x: 0, y: 0 };
        this.isEnabled = false;

        // Read current values from sliders
        const strengthSlider = document.getElementById('mouse-force-strength-slider');
        const radiusSlider = document.getElementById('mouse-force-radius-slider');

        this.forceStrength = strengthSlider ? parseFloat(strengthSlider.value) : 200.0;
        this.forceRadius = radiusSlider ? parseFloat(radiusSlider.value) : 0.5;

        // Read current attract/repel state from button
        const toggleBtn = document.getElementById('toggle-force-type-btn');
        this.isAttract = !toggleBtn || !toggleBtn.classList.contains('repel-mode');

        this.setupEventListeners();
        this.createRadiusIndicator();
    }
    setupEventListeners() {
        if (!this.canvas) return;

        this.canvas.addEventListener('mousemove', (event) => {
            this.updateMousePosition(event);
            this.updateRadiusIndicator(event);

        });

        this.canvas.addEventListener('mouseleave', () => {
            this.isEnabled = false;
            this.hideRadiusIndicator();

        });

        this.canvas.addEventListener('mouseenter', () => {
            const checkbox = document.getElementById('mouse-interaction-checkbox');
            if (checkbox && checkbox.checked) {
                this.isEnabled = true;
                this.showRadiusIndicator();
                this.updateRadiusIndicatorColor();

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

        if (this.canvas) {
            // this.canvas.style.cursor = enabled ? 'crosshair' : 'default';
            // this.canvas.style.cursor = 'default';
            this.canvas.style.cursor = 'none';


        }

        if (enabled) {
            this.showRadiusIndicator();
            this.forceMousePositionUpdate();

        } else {
            this.hideRadiusIndicator();
        }
    }
    forceMousePositionUpdate() {
        // Get current mouse position if possible
        if (this.canvas) {
            const rect = this.canvas.getBoundingClientRect();
            // Use center of canvas as fallback if we can't get real mouse position
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            // Simulate a mouse event at canvas center to update position
            const fakeEvent = {
                clientX: centerX,
                clientY: centerY
            };
            this.updateMousePosition(fakeEvent);
        }
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
        this.updateRadiusIndicatorColor();
        //update ui 
        this.updateUIButton();

    }
    updateUIButton() {
        const toggleBtn = document.getElementById('toggle-force-type-btn');
        if (toggleBtn) {
            // Clear existing classes and content
            toggleBtn.classList.remove('attract-mode', 'repel-mode');

            if (this.isAttract) {
                toggleBtn.innerHTML = '💥 Switch to Repel';  // Use innerHTML instead of textContent
                toggleBtn.classList.add('attract-mode');
            } else {
                toggleBtn.innerHTML = '🧲 Switch to Attract';  // Use innerHTML instead of textContent  
                toggleBtn.classList.add('repel-mode');
            }

            console.log("Button updated - classes:", toggleBtn.className, "text:", toggleBtn.textContent.trim());
        }
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
        indicator.textContent = this.isAttract ? 'Attract Mode' : ' Repel Mode';
        document.body.appendChild(indicator);

        setTimeout(() => {
            indicator.style.opacity = '0';
            setTimeout(() => indicator.remove(), 300);
        }, 1000);
    }
    createRadiusIndicator() {
        // Check if indicator already exists
        if (document.getElementById('mouse-radius-indicator')) {
            this.radiusIndicator = document.getElementById('mouse-radius-indicator');
            return;
        }

        this.radiusIndicator = document.createElement('div');
        this.radiusIndicator.id = 'mouse-radius-indicator';
        this.radiusIndicator.style.cssText = `
        position: fixed;
        pointer-events: none;
        border: 2px solid rgba(255, 255, 255, 0.8);
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.05);
        z-index: 999;
        display: none;
        transform: translate(-50%, -50%);
    `;
        document.body.appendChild(this.radiusIndicator);
    }
    updateRadiusIndicator(event) {
        if (!this.radiusIndicator || !this.isEnabled) return;

        const rect = this.canvas.getBoundingClientRect();
        const aspectRatio = rect.width / rect.height;
        const radiusPixels = (this.forceRadius * rect.height) / 2 * 0.09;

        this.radiusIndicator.style.left = event.clientX + 'px';
        this.radiusIndicator.style.top = event.clientY + 'px';
        this.radiusIndicator.style.width = (radiusPixels * 2) + 'px';
        this.radiusIndicator.style.height = (radiusPixels * 2) + 'px';
        this.radiusIndicator.style.display = 'block';
    }

    updateRadiusIndicatorColor() {
        if (!this.radiusIndicator) return;

        const color = this.isAttract ? '76, 175, 80' : '244, 67, 54';
        this.radiusIndicator.style.borderColor = `rgba(${color}, 0.8)`;
        this.radiusIndicator.style.backgroundColor = `rgba(${color}, 0.1)`;
    }

    showRadiusIndicator() {
        if (this.radiusIndicator) {
            this.radiusIndicator.style.display = 'block';
            this.updateRadiusIndicatorColor();
        }
    }

    hideRadiusIndicator() {
        if (this.radiusIndicator) {
            this.radiusIndicator.style.display = 'none';
        }
    }
}

window.MouseInteraction = MouseInteraction;