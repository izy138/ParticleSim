// Updated mouse-interaction.js with fix for initial center force issue

class MouseInteraction {
    constructor(canvasId) {
        this.canvasId = canvasId;
        this.canvas = document.getElementById(canvasId);
        this.mousePos = { x: 0, y: 0 };
        this.isEnabled = false;
        this.hasValidMousePosition = false; // NEW: Track if we have a valid mouse position

        // Read current values from sliders
        const strengthSlider = document.getElementById('mouse-force-strength-slider');
        const radiusSlider = document.getElementById('mouse-force-radius-slider');

        this.forceStrength = strengthSlider ? parseFloat(strengthSlider.value) : 200.0;
        this.forceRadius = radiusSlider ? parseFloat(radiusSlider.value) : 0.5;

        // Read current attract/repel state from button
        const toggleBtn = document.getElementById('toggle-force-type-btn');
        this.isAttract = !toggleBtn || !toggleBtn.classList.contains('repel-mode');

        // Store reference to UI controller for synchronization
        this.uiController = null;

        this.setupEventListeners();
        this.createRadiusIndicator();
    }

    // Method to set UI controller reference
    setUIController(uiController) {
        this.uiController = uiController;
    }

    setupEventListeners() {
        if (!this.canvas) return;

        this.canvas.addEventListener('mousemove', (event) => {
            this.updateMousePosition(event);
            this.updateRadiusIndicator(event);
            this.hasValidMousePosition = true; // NEW: Mark that we have a valid position
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.isEnabled = false;
            this.hasValidMousePosition = false; // NEW: Reset valid position flag
            this.hideRadiusIndicator();
        });

        this.canvas.addEventListener('mouseenter', () => {
            const checkbox = document.getElementById('mouse-interaction-checkbox');
            if (checkbox && checkbox.checked) {
                this.isEnabled = true;
                this.showRadiusIndicator();
                this.updateRadiusIndicatorColor();
                // Note: hasValidMousePosition will be set to true on first mousemove
            }
        });

        // Canvas click handler
        this.canvas.addEventListener('click', () => {
            if (this.isEnabled && this.hasValidMousePosition) { // NEW: Only toggle if we have valid position
                this.isAttract = !this.isAttract;
                this.showForceTypeIndicator();
                this.updateRadiusIndicatorColor();

                // Update UI button through the UI controller
                if (this.uiController && this.uiController.updateToggleButton) {
                    this.uiController.updateToggleButton();
                }
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
            // NEW: Only enable force if we have both enabled state AND valid mouse position
            enabled: (this.isEnabled && this.hasValidMousePosition) ? 1.0 : 0.0,
            strength: this.isAttract ? this.forceStrength : -this.forceStrength,
            radius: this.forceRadius
        };
    }

    setEnabled(enabled) {
        this.isEnabled = enabled;

        if (this.canvas) {
            this.canvas.style.cursor = enabled ? 'none' : 'default';
        }

        if (enabled) {
            // Don't force position update or show indicator until mouse actually moves
            // this.forceMousePositionUpdate(); // REMOVED: This was causing the center force issue
        } else {
            this.hasValidMousePosition = false; // NEW: Reset when disabled
            this.hideRadiusIndicator();
        }
    }

    // REMOVED: forceMousePositionUpdate method since it was causing the issue

    setForceStrength(strength) {
        this.forceStrength = Math.abs(strength);
    }

    setForceRadius(radius) {
        this.forceRadius = Math.max(0.1, Math.min(1.0, radius));
    }

    toggleForceType() {
        if (this.hasValidMousePosition) { // NEW: Only toggle if we have valid position
            this.isAttract = !this.isAttract;
            this.showForceTypeIndicator();
            this.updateRadiusIndicatorColor();

            // Update UI button through the UI controller
            if (this.uiController && this.uiController.updateToggleButton) {
                this.uiController.updateToggleButton();
            }
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
        indicator.textContent = this.isAttract ? 'Attract Mode' : 'Repel Mode';
        document.body.appendChild(indicator);

        setTimeout(() => {
            indicator.style.opacity = '0';
            setTimeout(() => indicator.remove(), 300);
        }, 1000);
    }

    createRadiusIndicator() {
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
        if (!this.radiusIndicator || !this.isEnabled || !this.hasValidMousePosition) return; // NEW: Check valid position

        const rect = this.canvas.getBoundingClientRect();
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
        if (this.radiusIndicator && this.hasValidMousePosition) { // NEW: Only show if valid position
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