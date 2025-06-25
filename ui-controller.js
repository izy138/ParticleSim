/**
 * UI Controller for Particle Life Simulator
 * Manages all UI interactions, sliders, buttons, and keyboard controls
 */

class UIController {
    constructor(simulationManager) {
        this.simulationManager = simulationManager;
        // this.simulator = null;
        this.forceParams = {
            strengthModifier: 110,
            radiusRange: 25,
            collisionStrengthRange: 750,
            collisionRadiusRange: 5
        };
        this.setupEventListeners();
        this.setupSliders();
        this.setupKeyboardControls();
        this.initializePanelState();
    }

    get simulator() {
        return this.simulationManager.simulator;
    }

    setupEventListeners() {
        // Main control buttons - single toggle button
        document.getElementById('play-pause-btn').addEventListener('click', () => this.togglePlayPause());
        document.getElementById('reset-btn').addEventListener('click', () => this.resetWithModification());
        document.getElementById('reset-positions-btn').addEventListener('click', () => this.resetPositionsOnly());
        document.getElementById('fullscreen-btn').addEventListener('click', () => this.toggleFullscreen());
        document.getElementById('panel-toggle-btn').addEventListener('click', () => this.togglePanel());
        // document.getElementById('reset-to-original-btn').addEventListener('click', () => this.resetToOriginal());

        // Configuration buttons
        document.getElementById('randomize-btn').addEventListener('click', () => this.randomizeForces());
        document.getElementById('new-config-btn').addEventListener('click', () => this.createNewConfiguration());

        // Save/load buttons
        document.getElementById('save-config-btn').addEventListener('click', () => this.saveConfiguration());
        document.getElementById('copy-config-btn').addEventListener('click', () => this.copyConfiguration());

        // Listen for fullscreen changes (e.g., user presses Escape)
        document.addEventListener('fullscreenchange', () => {
            const mainContainer = document.querySelector('.main-container');
            const fullscreenBtn = document.getElementById('fullscreen-btn');
            
            if (!document.fullscreenElement) {
                // Fullscreen was exited (by any means)
                mainContainer.classList.remove('fullscreen');
                fullscreenBtn.classList.remove('fullscreen');
                fullscreenBtn.textContent = '🖥️ Fullscreen';
                
                // Force recalculation of normal canvas size
                setTimeout(() => {
                    if (this.simulationManager.responsiveSystem) {
                        this.simulationManager.responsiveSystem.applyCanvasSize(null);
                    }
                }, 100);
                
                console.log('Fullscreen exited (external)');
            }
        });
    }

    setupSliders() {
        // Main parameter sliders
        this.setupFrictionSlider();
        this.setupForceScaleSlider();
        this.setupParticleAppearanceSliders();
        this.setupForceParameterSliders();
    }

    setupFrictionSlider() {
        const frictionSlider = document.getElementById('friction-slider');
        if (frictionSlider) {
            if (this.simulator && this.simulator.config) {
                frictionSlider.value = this.simulator.config.friction;
                document.getElementById('friction-value').textContent = this.simulator.config.friction;
            }

            frictionSlider.addEventListener('input', () => {
                document.getElementById('friction-value').textContent = frictionSlider.value;
                this.updateFriction(parseFloat(frictionSlider.value));
            });
        }
    }

    setupForceScaleSlider() {
        const scaleSlider = document.getElementById('force-scale-slider');
        if (scaleSlider) {
            scaleSlider.addEventListener('input', () => {
                document.getElementById('force-scale-value').textContent = scaleSlider.value;
                this.updateForceScale(parseFloat(scaleSlider.value));
            });
        }
    }

    setupParticleAppearanceSliders() {
        const sizeSlider = document.getElementById('particle-size-slider');
        const opacitySlider = document.getElementById('particle-opacity-slider');

        if (sizeSlider) {
            sizeSlider.addEventListener('input', () => {
                document.getElementById('particle-size-value').textContent = sizeSlider.value;
                this.updateParticleSize(parseFloat(sizeSlider.value));
            });
        }

        if (opacitySlider) {
            opacitySlider.addEventListener('input', () => {
                document.getElementById('particle-opacity-value').textContent = opacitySlider.value;
                this.updateParticleOpacity(parseFloat(opacitySlider.value));
            });
        }
    }

    setupForceParameterSliders() {
        const defaults = {
            strengthModifier: 110,
            radiusRange: 25,
            collisionStrengthRange: 750,
            collisionRadiusRange: 4
        };

        const strengthSlider = document.getElementById('strength-modifier-slider');
        const radiusSlider = document.getElementById('radius-range-slider');
        const collisionStrengthSlider = document.getElementById('collision-strength-range-slider');
        const collisionRadiusSlider = document.getElementById('collision-radius-range-slider');

        if (strengthSlider) {
            strengthSlider.addEventListener('input', () => {
                this.forceParams.strengthModifier = parseFloat(strengthSlider.value);
                const valueElement = document.getElementById('strength-modifier-value');
                valueElement.textContent = strengthSlider.value;

                // Add visual feedback if value changed from default
                if (parseFloat(strengthSlider.value) !== defaults.strengthModifier) {
                    valueElement.classList.add('changed');
                } else {
                    valueElement.classList.remove('changed');
                }
            });
        }

        if (radiusSlider) {
            radiusSlider.addEventListener('input', () => {
                this.forceParams.radiusRange = parseFloat(radiusSlider.value);
                const valueElement = document.getElementById('radius-range-value');
                valueElement.textContent = radiusSlider.value;

                // Add visual feedback if value changed from default
                if (parseFloat(radiusSlider.value) !== defaults.radiusRange) {
                    valueElement.classList.add('changed');
                } else {
                    valueElement.classList.remove('changed');
                }
            });
        }

        if (collisionStrengthSlider) {
            collisionStrengthSlider.addEventListener('input', () => {
                this.forceParams.collisionStrengthRange = parseFloat(collisionStrengthSlider.value);
                const valueElement = document.getElementById('collision-strength-range-value');
                valueElement.textContent = collisionStrengthSlider.value;

                // Add visual feedback if value changed from default
                if (parseFloat(collisionStrengthSlider.value) !== defaults.collisionStrengthRange) {
                    valueElement.classList.add('changed');
                } else {
                    valueElement.classList.remove('changed');
                }
            });
        }

        if (collisionRadiusSlider) {
            collisionRadiusSlider.addEventListener('input', () => {
                this.forceParams.collisionRadiusRange = parseFloat(collisionRadiusSlider.value);
                const valueElement = document.getElementById('collision-radius-range-value');
                valueElement.textContent = collisionRadiusSlider.value;

                // Add visual feedback if value changed from default
                if (parseFloat(collisionRadiusSlider.value) !== defaults.collisionRadiusRange) {
                    valueElement.classList.add('changed');
                } else {
                    valueElement.classList.remove('changed');
                }
            });
        }

        // Reset button
        const resetBtn = document.getElementById('reset-force-params-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.forceParams = {
                    strengthModifier: 110,
                    radiusRange: 25,
                    collisionStrengthRange: 750,
                    collisionRadiusRange: 4
                };

                strengthSlider.value = 110;
                radiusSlider.value = 25;
                collisionStrengthSlider.value = 750;
                collisionRadiusSlider.value = 4;

                // Update displays and remove changed styling
                const strengthValue = document.getElementById('strength-modifier-value');
                const radiusValue = document.getElementById('radius-range-value');
                const collisionStrengthValue = document.getElementById('collision-strength-range-value');
                const collisionRadiusValue = document.getElementById('collision-radius-range-value');

                strengthValue.textContent = '110';
                radiusValue.textContent = '25';
                collisionStrengthValue.textContent = '750';
                collisionRadiusValue.textContent = '4';

                // Remove changed styling from all value elements
                strengthValue.classList.remove('changed');
                radiusValue.classList.remove('changed');
                collisionStrengthValue.classList.remove('changed');
                collisionRadiusValue.classList.remove('changed');
            });
        }
    }

    setupKeyboardControls() {
        let isProcessing = false;

        document.addEventListener('keydown', async (event) => {
            if (isProcessing) return; // Prevent rapid-fire key presses

            // Prevent default for handled keys
            if (['Space', 'KeyP', 'KeyR', 'KeyF', 'KeyN'].includes(event.code)) {
                event.preventDefault();
            }

            // Show visual feedback
            const showFeedback = (message, color = '#28a745') => {
                const feedback = document.createElement('div');
                feedback.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 10px 20px;
                background: ${color};
                color: white;
                border-radius: 5px;
                font-weight: bold;
                z-index: 1000;
                animation: slideIn 0.3s ease-out;
            `;
                feedback.textContent = message;
                document.body.appendChild(feedback);

                setTimeout(() => {
                    feedback.style.animation = 'slideOut 0.3s ease-in';
                    setTimeout(() => feedback.remove(), 300);
                }, 2000);
            };

            try {
                isProcessing = true;

                switch (event.code) {
                    case 'Space':
                        showFeedback('🎲 Randomizing Forces...', '#FF9800');
                        await this.randomizeForces();
                        break;
                    // case 'KeyG':
                    //     showFeedback('🔄 Generating New Config...', '#28a745');
                    //     await this.simulationManager.restartWithNewConfiguration();
                    //     break;
                    case 'KeyN':
                        showFeedback('✨ Creating New Complete Config...', '#9C27B0');
                        await this.createNewConfiguration();
                        break;
                    case 'KeyP':
                        if (this.simulator) {
                            this.togglePlayPause();
                            showFeedback(this.simulator.isPaused ? '⏸️ Paused' : '▶️ Resumed', '#2196F3');
                        }
                        break;
                    case 'KeyR':
                        if (this.simulator) {
                            this.simulator.reset();
                            this.updateButtonStates();
                            showFeedback('🔄 Reset', '#2196F3');
                        }
                        break;
                    case 'KeyF':
                        if (event.ctrlKey) {
                            event.preventDefault();
                            this.toggleFullscreen();
                            showFeedback('🖥️ Fullscreen Toggled', '#9C27B0');
                        }
                        break;
                    case 'Tab':
                        event.preventDefault();
                        this.togglePanel();
                        showFeedback('📋 Panel Toggled', '#FF9800');
                        break;
                }
            } catch (error) {
                showFeedback('❌ Error: ' + error.message, '#f44336');
                console.error('Keyboard action error:', error);
            } finally {
                isProcessing = false;
            }
        });
    }

    updateButtonStates() {
        const playPauseBtn = document.getElementById('play-pause-btn');
        const resetBtn = document.getElementById('reset-btn');

        if (!this.simulator) {
            playPauseBtn.disabled = false;
            resetBtn.disabled = true;
            playPauseBtn.textContent = '▶️';
            playPauseBtn.classList.remove('paused');
            return;
        }

        if (!this.simulator.isRunning) {
            playPauseBtn.disabled = false;
            resetBtn.disabled = false;
            playPauseBtn.textContent = '▶️';
            playPauseBtn.classList.remove('paused');
        } else {
            playPauseBtn.disabled = false;
            resetBtn.disabled = false;

            if (this.simulator.isPaused) {
                playPauseBtn.textContent = '▶️';
                playPauseBtn.classList.remove('paused');
            } else {
                playPauseBtn.textContent = '⏸️';
                playPauseBtn.classList.add('paused');
            }
        }
    }

    updateConfigDisplay(config) {
        const display = document.getElementById('config-display');
        if (!display) return;

        const antisocialCount = config.species.filter(species =>
            species.forces.some((force, index) => index === config.species.indexOf(species) && force.strength < 0)
        ).length;

        const totalForces = config.species.length * config.species.length;
        const attractiveForces = config.species.reduce((count, species) =>
            count + species.forces.filter(force => force.strength > 0).length, 0
        );
        const repulsiveForces = totalForces - attractiveForces;

        // Add aspect ratio information
        const canvas = document.getElementById('webgpu-canvas');
        const aspectRatio = canvas ? (canvas.width / canvas.height).toFixed(2) : 'Unknown';
        const canvasInfo = config.simulationSize ?
            `${config.simulationSize[0]}×${config.simulationSize[1]}` :
            'Unknown';

        display.innerHTML = `
            <strong>Current Configuration:</strong><br>
            • Particle Types: ${config.species.length}<br>
            • Total Particles: ${config.particleCount.toLocaleString()}<br>
            • Canvas Size: ${canvasInfo}<br>
            • Aspect Ratio: ${aspectRatio}:1<br>
            • Particle Size: ${config.particleSize}<br>
            • Antisocial Types: ${antisocialCount}<br>
            • Force Balance: ${attractiveForces} attractive, ${repulsiveForces} repulsive<br>
            • Friction: ${config.friction}<br>
            • Last Updated: ${new Date().toLocaleTimeString()}
        `;
    }

    syncSlidersWithConfig() {
        if (!this.simulator || !this.simulator.config) return;

        const frictionSlider = document.getElementById('friction-slider');
        if (frictionSlider) {
            frictionSlider.value = this.simulator.config.friction;
            document.getElementById('friction-value').textContent = this.simulator.config.friction;
        }

        const sizeSlider = document.getElementById('particle-size-slider');
        if (sizeSlider) {
            sizeSlider.value = this.simulator.config.particleSize;
            document.getElementById('particle-size-value').textContent = this.simulator.config.particleSize;
        }

        const opacitySlider = document.getElementById('particle-opacity-slider');
        if (opacitySlider) {
            opacitySlider.value = this.simulator.config.particleOpacity;
            document.getElementById('particle-opacity-value').textContent = this.simulator.config.particleOpacity;
        }

        // console.log("Sliders synced with configuration");
    }

    // Event handlers:
    startSimulation() {
        // This would be handled by the simulation manager
        console.log("Start simulation requested");
    }

    stopSimulation() {
        if (this.simulator) {
            this.simulator.stop();
            this.updateButtonStates();
        }
    }

    togglePause() {
        if (this.simulator) {
            this.simulator.togglePause();
            this.updateButtonStates();
        }
    }

    togglePlayPause() {
        if (this.simulator) {
            if (!this.simulator.isRunning) {
                // Start the simulation
                this.simulationManager.startSimulation();
            } else {
                // Toggle pause state
                this.simulator.togglePause();
            }
            this.updateButtonStates();
        }
    }

    toggleFullscreen() {
        const mainContainer = document.querySelector('.main-container');
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        
        if (!document.fullscreenElement) {
            // Enter fullscreen
            mainContainer.requestFullscreen().then(() => {
                mainContainer.classList.add('fullscreen');
                fullscreenBtn.classList.add('fullscreen');
                fullscreenBtn.textContent = '🖥️ Exit Fullscreen';
                
                // Resize canvas after fullscreen
                setTimeout(() => {
                    if (this.simulationManager.responsiveSystem) {
                        this.simulationManager.responsiveSystem.applyCanvasSize();
                    }
                }, 100);
                
                console.log('Entered fullscreen mode');
            }).catch(err => {
                console.error('Error entering fullscreen:', err);
            });
        } else {
            // Exit fullscreen
            document.exitFullscreen().then(() => {
                mainContainer.classList.remove('fullscreen');
                fullscreenBtn.classList.remove('fullscreen');
                fullscreenBtn.textContent = '🖥️ Fullscreen';
                
                // Force recalculation of normal canvas size after fullscreen exit
                setTimeout(() => {
                    if (this.simulationManager.responsiveSystem) {
                        // Force a complete recalculation by passing null to applyCanvasSize
                        this.simulationManager.responsiveSystem.applyCanvasSize(null);
                    }
                }, 100);
                
                console.log('Exited fullscreen mode');
            }).catch(err => {
                console.error('Error exiting fullscreen:', err);
            });
        }
    }

    resetWithModification() {
        if (this.simulator) {
            const resetBtn = document.getElementById('reset-btn');
            resetBtn.disabled = true;
            resetBtn.textContent = 'Modifying Forces...';

            try {
                this.simulator.resetWithModifiedBaseline(this.forceParams);
                this.updateButtonStates();

                resetBtn.textContent = '✓ Forces Modified!';
                setTimeout(() => {
                    resetBtn.textContent = 'Reset + Modify Forces';
                    resetBtn.disabled = false;
                }, 1000);

            } catch (error) {
                console.error('Error during reset:', error);
                resetBtn.textContent = '✗ Error';
                setTimeout(() => {
                    resetBtn.textContent = 'Reset + Modify Forces';
                    resetBtn.disabled = false;
                }, 2000);
            }
        }
    }

    resetPositionsOnly() {
        if (this.simulator) {
            // This is the old reset behavior - just reset positions, keep same forces
            this.simulator.resetPositionsOnly();
            this.updateButtonStates();
        }
    }

    resetToOriginal() {
        if (this.simulator) {
            this.simulator.resetToOriginalForces();

            // Reset sliders to defaults
            document.getElementById('strength-modifier-slider').value = 110;
            document.getElementById('radius-range-slider').value = 25;
            document.getElementById('collision-strength-range-slider').value = 750;
            document.getElementById('collision-radius-range-slider').value = 4;

            // Update displays
            document.getElementById('strength-modifier-value').textContent = '110';
            document.getElementById('radius-range-value').textContent = '25';
            document.getElementById('collision-strength-range-value').textContent = '750';
            document.getElementById('collision-radius-range-value').textContent = '4';

            // Reset forceParams
            this.forceParams = {
                strengthModifier: 110,
                radiusRange: 25,
                collisionStrengthRange: 750,
                collisionRadiusRange: 4
            };
        }
    }

    async randomizeForces() {
        const randomizeBtn = document.getElementById('randomize-btn');
        if (randomizeBtn) {
            randomizeBtn.disabled = true;
            randomizeBtn.textContent = 'Randomizing...';

            try {
                await this.simulationManager.randomizeForces();
                randomizeBtn.textContent = '✓ Randomized!';
                setTimeout(() => {
                    randomizeBtn.textContent = 'Randomize Forces';
                    randomizeBtn.disabled = false;
                }, 1000);
            } catch (error) {
                randomizeBtn.textContent = '✗ Error';
                setTimeout(() => {
                    randomizeBtn.textContent = 'Randomize Forces';
                    randomizeBtn.disabled = false;
                }, 2000);
            }
        }
    }

    async createNewConfiguration() {
        const newConfigBtn = document.getElementById('new-config-btn');
        if (newConfigBtn) {
            newConfigBtn.disabled = true;
            newConfigBtn.textContent = 'Creating New...';

            try {
                await this.simulationManager.restartWithNewConfiguration();
                newConfigBtn.textContent = '✓ New Config!';
                setTimeout(() => {
                    newConfigBtn.textContent = 'New Complete Config';
                    newConfigBtn.disabled = false;
                }, 1000);
            } catch (error) {
                newConfigBtn.textContent = '✗ Error';
                setTimeout(() => {
                    newConfigBtn.textContent = 'New Complete Config';
                    newConfigBtn.disabled = false;
                }, 2000);
            }
        }
    }

    saveConfiguration() {
        ConfigUtils.saveCurrentConfiguration(this.simulator);
    }

    copyConfiguration() {
        ConfigUtils.copyConfigurationToClipboard(this.simulator);
    }

    updateFriction(value) {
        if (!this.simulator || !this.simulator.gpu || !this.simulator.gpu.device) return;

        this.simulator.config.friction = value;
        const dt = 0.001;
        const friction = Math.exp(-Math.log(2) * dt / (value * 0.001));

        // UPDATED: Include aspect ratio in uniform data
        const aspectRatio = this.simulator.gpu.canvas.width / this.simulator.gpu.canvas.height;

        const uniformData = new Float32Array([
            0.02,   // radius
            0.15,   // rMax
            dt,     // dt
            friction, // friction
            this.simulator.config.centralForce || 0.0, // central force
            this.simulator.config.numTypes || 3,       // numTypes
            aspectRatio,                          // aspect ratio
            0.0     // padding
        ]);

        this.simulator.gpu.device.queue.writeBuffer(
            this.simulator.uniformBuffer,
            0,
            uniformData
        );

        console.log('Friction updated with aspect ratio:', aspectRatio);
    }

    updateForceScale(value) {
        if (!this.simulator || !this.simulator.config) return;

        const { numTypes, strengthMatrix, collisionStrengthMatrix } = this.simulator.config;
        const scaledStrength = strengthMatrix.map(v => v * value);
        const scaledCollisionStrength = collisionStrengthMatrix.map(v => v * value);

        if (this.simulator.gpu && this.simulator.gpu.device) {
            const device = this.simulator.gpu.device;

            device.queue.writeBuffer(
                this.simulator.strengthBuffer,
                0,
                new Float32Array(scaledStrength)
            );

            device.queue.writeBuffer(
                this.simulator.collisionStrengthBuffer,
                0,
                new Float32Array(scaledCollisionStrength)
            );
        }
    }

    updateParticleSize(value) {
        if (this.simulator && this.simulator.updateParticleAppearance) {
            const currentOpacity = this.simulator.config.particleOpacity;
            this.simulator.updateParticleAppearance(value, currentOpacity);
        }
    }

    updateParticleOpacity(value) {
        if (this.simulator && this.simulator.updateParticleAppearance) {
            const currentSize = this.simulator.config.particleSize;
            this.simulator.updateParticleAppearance(currentSize, value);
        }
    }

    // Helper method to set simulator reference
    setSimulator(simulator) {
        this.simulator = simulator;
    }

    togglePanel() {
        const rightPanel = document.getElementById('right-panel');
        const toggleBtn = document.getElementById('panel-toggle-btn');
        
        // Toggle panel state in responsive system
        this.simulationManager.responsiveSystem.togglePanel();
        
        // Update UI classes
        if (this.simulationManager.responsiveSystem.panelOpen) {
            rightPanel.classList.remove('panel-closed');
            rightPanel.classList.add('panel-open');
            toggleBtn.classList.remove('panel-closed');
            toggleBtn.classList.add('panel-open');
            toggleBtn.textContent = '▶';
        } else {
            rightPanel.classList.remove('panel-open');
            rightPanel.classList.add('panel-closed');
            toggleBtn.classList.remove('panel-open');
            toggleBtn.classList.add('panel-closed');
            toggleBtn.textContent = '◀';
        }
        
        console.log('Panel toggled:', this.simulationManager.responsiveSystem.panelOpen ? 'open' : 'closed');
    }

    initializePanelState() {
        const rightPanel = document.getElementById('right-panel');
        const toggleBtn = document.getElementById('panel-toggle-btn');
        
        if (this.simulationManager.responsiveSystem.panelOpen) {
            rightPanel.classList.remove('panel-closed');
            rightPanel.classList.add('panel-open');
            toggleBtn.classList.remove('panel-closed');
            toggleBtn.classList.add('panel-open');
            toggleBtn.textContent = '▶';
        } else {
            rightPanel.classList.remove('panel-open');
            rightPanel.classList.add('panel-closed');
            toggleBtn.classList.remove('panel-open');
            toggleBtn.classList.add('panel-closed');
            toggleBtn.textContent = '◀';
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIController;
} else {
    // Make available globally for browser use
    window.UIController = UIController;
}