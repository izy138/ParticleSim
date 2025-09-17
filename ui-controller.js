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
        document.getElementById('create-custom-sim-btn').addEventListener('click', () => this.createCustomSimulation());

        // Save/load buttons
        document.getElementById('save-config-btn').addEventListener('click', () => this.saveConfiguration());
        document.getElementById('load-config-btn').addEventListener('click', () => this.loadConfiguration());
        document.getElementById('config-file-input').addEventListener('change', (event) => this.handleFileSelect(event));

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

        // Setup drag and drop for configuration files
        this.setupDragAndDrop();
        // Add these mouse interaction event listeners
        this.setupMouseInteractionListeners();
    }

    setupSliders() {
        // Main parameter sliders
        this.setupFrictionSlider();
        this.setupForceScaleSlider();
        this.setupParticleAppearanceSliders();
        this.setupForceParameterSliders();
        this.setupGenerationSliders();
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
                this.updateParticleSize(parseFloat(sizeSlider.value) / 1000);  //should be 0.007 => changed it to 7
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

    setupGenerationSliders() {
        // Particle Types Slider
        const particleTypesSlider = document.getElementById('particle-types-slider');
        if (particleTypesSlider) {
            particleTypesSlider.addEventListener('input', () => {
                const value = particleTypesSlider.value;
                document.getElementById('particle-types-value').textContent = value;
            });
        }

        // Total Particles Slider
        const totalParticlesSlider = document.getElementById('total-particles-slider');
        if (totalParticlesSlider) {
            totalParticlesSlider.addEventListener('input', () => {
                const value = totalParticlesSlider.value;
                document.getElementById('total-particles-value').textContent = value;
            });
        }

        // Central Force Checkbox
        const centralForceCheckbox = document.getElementById('central-force-checkbox');
        if (centralForceCheckbox) {
            centralForceCheckbox.addEventListener('change', () => {
                // No need to update display for checkbox
            });
        }

        // Looping Borders Checkbox
        const loopingBordersCheckbox = document.getElementById('looping-borders-checkbox');
        if (loopingBordersCheckbox) {
            loopingBordersCheckbox.addEventListener('change', () => {
                // No need to update display for checkbox
            });
        }
    }

    setupKeyboardControls() {
        let isProcessing = false;

        document.addEventListener('keydown', async (event) => {
            if (isProcessing) return; // Prevent rapid-fire key presses

            // Prevent default for handled keys
            if (['Space', 'KeyP', 'KeyR', 'KeyF', 'KeyN', 'KeyL'].includes(event.code)) {
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
                        // showFeedback('🎲 Randomizing Forces...', '#FF9800');
                        await this.randomizeForces();
                        break;
                    // case 'KeyG':
                    //     showFeedback('🔄 Generating New Config...', '#28a745');
                    //     await this.simulationManager.restartWithNewConfiguration();
                    //     break;
                    case 'KeyN':
                        // showFeedback('✨ Creating New Complete Config...', '#9C27B0');
                        await this.createNewConfiguration();
                        break;
                    case 'KeyP':
                        if (this.simulator) {
                            this.togglePlayPause();
                            // showFeedback(this.simulator.isPaused ? '⏸️ Paused' : '▶️ Resumed', '#2196F3');
                        }
                        break;
                    case 'KeyR':
                        if (this.simulator) {
                            this.simulator.reset();
                            this.updateButtonStates();
                            // showFeedback('🔄 Reset', '#2196F3');
                        }
                        break;
                    case 'KeyF':
                        if (event.ctrlKey) {
                            event.preventDefault();
                            this.toggleFullscreen();
                            // showFeedback('🖥️ Fullscreen Toggled', '#9C27B0');
                        }
                        break;
                    case 'KeyL':
                        if (event.ctrlKey) {
                            event.preventDefault();
                            this.loadConfiguration();
                            // showFeedback('📁 Loading Configuration...', '#FF9800');
                        }
                        break;
                    case 'Tab':
                        event.preventDefault();
                        this.togglePanel();
                        // showFeedback('📋 Panel Toggled', '#FF9800');
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

        // Get custom parameters from sliders
        const centralForce = document.getElementById('central-force-checkbox')?.checked ? 'Yes' : 'No';
        const loopingBorders = document.getElementById('looping-borders-checkbox')?.checked ? 'Yes' : 'No';
        const particleTypes = document.getElementById('particle-types-slider')?.value || config.species.length;
        const totalParticles = document.getElementById('total-particles-slider')?.value || config.particleCount;
        const forceScale = document.getElementById('force-scale-slider')?.value || '1.0';

        display.innerHTML = `
            <strong>Current Configuration:</strong><br>
            • Particle Types: ${config.species.length} (max: ${particleTypes})<br>
            • Total Particles: ${config.particleCount.toLocaleString()} (max: ${totalParticles})<br>
            • Canvas Size: ${canvasInfo}<br>
            • Aspect Ratio: ${aspectRatio}:1<br>
            • Particle Size: ${config.particleSize}<br>
            • Antisocial Types: ${antisocialCount}<br>
            • Force Balance: ${attractiveForces} attractive, ${repulsiveForces} repulsive<br>
            • Friction: ${config.friction}<br>
            • Force Scale: ${forceScale}<br>
            • Central Force: ${centralForce}<br>
            • Looping Borders: ${loopingBorders === '1' ? 'Yes' : 'No'}<br>
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

        // Sync force scale slider
        const forceScaleSlider = document.getElementById('force-scale-slider');
        if (forceScaleSlider) {
            // Default to 1.0 if not set in config
            forceScaleSlider.value = this.simulator.config.forceScale || 1.0;
            document.getElementById('force-scale-value').textContent = forceScaleSlider.value;
        }

        // Sync generation sliders
        const particleTypesSlider = document.getElementById('particle-types-slider');
        if (particleTypesSlider) {
            particleTypesSlider.value = this.simulator.config.species?.length || 5;
            document.getElementById('particle-types-value').textContent = particleTypesSlider.value;
        }

        const totalParticlesSlider = document.getElementById('total-particles-slider');
        if (totalParticlesSlider) {
            totalParticlesSlider.value = this.simulator.config.particleCount || 12000;
            document.getElementById('total-particles-value').textContent = totalParticlesSlider.value;
        }

        const centralForceSlider = document.getElementById('central-force-checkbox');
        if (centralForceSlider) {
            centralForceSlider.checked = this.simulator.config.centralForce ? true : false;
        }

        const loopingBordersSlider = document.getElementById('looping-borders-checkbox');
        if (loopingBordersSlider) {
            loopingBordersSlider.checked = this.simulator.config.loopingBorders ? true : false;
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
                    resetBtn.textContent = 'Update Forces';
                    resetBtn.disabled = false;
                }, 1000);

            } catch (error) {
                console.error('Error during reset:', error);
                resetBtn.textContent = '✗ Error';
                setTimeout(() => {
                    // resetBtn.textContent = 'Reset + Modify Forces';
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

                // Update the force parameter sliders to reflect the values used for randomization
                const radiusSlider = document.getElementById('radius-range-slider');
                const collisionRadiusSlider = document.getElementById('collision-radius-range-slider');

                if (radiusSlider) {
                    radiusSlider.value = 32; // 22Specific value used for randomization
                    document.getElementById('radius-range-value').textContent = '32';
                    this.forceParams.radiusRange = 32;
                }

                if (collisionRadiusSlider) {
                    collisionRadiusSlider.value = 6; //5.5 Specific value used for randomization
                    document.getElementById('collision-radius-range-value').textContent = '6';
                    this.forceParams.collisionRadiusRange = 6;
                }

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
            // newConfigBtn.textContent = 'Creating New...';

            try {
                await this.simulationManager.restartWithNewConfiguration();
                newConfigBtn.textContent = '✓ New Config!';
                setTimeout(() => {
                    newConfigBtn.textContent = 'Generate Random';
                    newConfigBtn.disabled = false;
                }, 1000);
            } catch (error) {
                newConfigBtn.textContent = '✗ Error';
                setTimeout(() => {
                    newConfigBtn.textContent = 'Error';
                    newConfigBtn.disabled = false;
                }, 2000);
            }
        }
    }

    async createCustomSimulation() {
        const customSimBtn = document.getElementById('create-custom-sim-btn');
        if (customSimBtn) {
            customSimBtn.disabled = true;
            // customSimBtn.textContent = 'Creating Custom...';

            try {
                await this.simulationManager.createCustomSimulation();
                customSimBtn.textContent = '✓ Custom Created!';
                setTimeout(() => {
                    customSimBtn.textContent = 'Create Custom Sim';
                    customSimBtn.disabled = false;
                }, 1000);
            } catch (error) {
                customSimBtn.textContent = '✗ Error';
                setTimeout(() => {
                    customSimBtn.textContent = 'Create Custom Sim';
                    customSimBtn.disabled = false;
                }, 2000);
            }
        }
    }

    saveConfiguration() {
        ConfigUtils.saveCurrentConfiguration(this.simulator);
    }

    loadConfiguration() {
        // Trigger the hidden file input
        document.getElementById('config-file-input').click();
    }

    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            // Show loading state
            const loadBtn = document.getElementById('load-config-btn');
            const originalText = loadBtn.textContent;
            loadBtn.disabled = true;
            loadBtn.textContent = 'Loading...';

            // Load the configuration
            const config = await ConfigUtils.loadConfigurationFromFile(file);

            // Check if type count is changing
            const currentTypes = this.simulator?.config?.numTypes || 0;
            const newTypes = config.species.length;

            if (currentTypes !== newTypes) {
                loadBtn.textContent = 'Restarting...';
            }

            // Apply the loaded configuration
            await this.simulationManager.loadConfiguration(config);

            // Show success feedback
            loadBtn.textContent = '✓ Loaded!';
            setTimeout(() => {
                loadBtn.textContent = originalText;
                loadBtn.disabled = false;
            }, 2000);

            // Clear the file input
            event.target.value = '';

        } catch (error) {
            console.error('Error loading configuration:', error);

            // Show error feedback
            const loadBtn = document.getElementById('load-config-btn');
            loadBtn.textContent = '✗ Error';
            setTimeout(() => {
                loadBtn.textContent = 'Load';
                loadBtn.disabled = false;
            }, 2000);

            // Show error message
            const display = document.getElementById('config-display');
            if (display) {
                const originalText = display.innerHTML;
                display.innerHTML = `<strong style="color: red;">✗ Load failed: ${error.message}</strong>`;
                setTimeout(() => {
                    display.innerHTML = originalText;
                }, 5000);
            }

            // Clear the file input
            event.target.value = '';
        }
    }

    updateFriction(value) {
        if (!this.simulator || !this.simulator.gpu || !this.simulator.gpu.device) return;

        this.simulator.config.friction = value;
        const dt = 0.001;
        const friction = Math.exp(-Math.log(2) * dt / (value * 0.001));

        // Include aspect ratio in uniform data
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

    // Setup drag and drop for configuration files
    setupDragAndDrop() {
        const mainContainer = document.getElementById('main-container');

        if (!mainContainer) return;

        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            mainContainer.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        // Handle drag enter and over
        ['dragenter', 'dragover'].forEach(eventName => {
            mainContainer.addEventListener(eventName, () => {
                mainContainer.classList.add('drag-over');
            });
        });

        // Handle drag leave
        mainContainer.addEventListener('dragleave', () => {
            mainContainer.classList.remove('drag-over');
        });

        // Handle drop
        mainContainer.addEventListener('drop', async (e) => {
            mainContainer.classList.remove('drag-over');

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];

                // Check if it's a JSON file
                if (file.type === 'application/json' || file.name.endsWith('.json')) {
                    try {
                        // Show loading feedback
                        const display = document.getElementById('config-display');
                        if (display) {
                            const originalText = display.innerHTML;
                            display.innerHTML = `<strong style="color: blue;">📁 Loading ${file.name}...</strong>`;

                            // Load the configuration
                            const config = await ConfigUtils.loadConfigurationFromFile(file);

                            // Check if type count is changing
                            const currentTypes = this.simulator?.config?.numTypes || 0;
                            const newTypes = config.species.length;

                            if (currentTypes !== newTypes) {
                                display.innerHTML = `<strong style="color: blue;">🔄 Restarting simulator for ${newTypes} particle types...</strong>`;
                            }

                            await this.simulationManager.loadConfiguration(config);

                            // Show success feedback
                            display.innerHTML = `<strong style="color: green;">✓ Loaded ${file.name} successfully!</strong>`;
                            setTimeout(() => {
                                display.innerHTML = originalText;
                            }, 3000);
                        }
                    } catch (error) {
                        console.error('Error loading dropped file:', error);

                        // Show error feedback
                        const display = document.getElementById('config-display');
                        if (display) {
                            const originalText = display.innerHTML;
                            display.innerHTML = `<strong style="color: red;">✗ Failed to load ${file.name}: ${error.message}</strong>`;
                            setTimeout(() => {
                                display.innerHTML = originalText;
                            }, 5000);
                        }
                    }
                } else {
                    // Show error for non-JSON files
                    const display = document.getElementById('config-display');
                    if (display) {
                        const originalText = display.innerHTML;
                        display.innerHTML = `<strong style="color: red;">✗ Please drop a JSON configuration file</strong>`;
                        setTimeout(() => {
                            display.innerHTML = originalText;
                        }, 3000);
                    }
                }
            }
        });
    }

    setupMouseInteractionListeners() {
        // Checkbox toggle
        const checkbox = document.getElementById('mouse-interaction-checkbox');
        const forceControls = document.querySelector('.mouse-force-controls'); // Add this line

        if (checkbox) {
            // Set initial state (hidden)
            if (forceControls) {
                forceControls.style.display = 'none'; // Add this line
            }

            checkbox.addEventListener('change', (e) => {
                const enabled = e.target.checked;

                // Show/hide force controls (Add these lines)
                if (forceControls) {
                    forceControls.style.display = enabled ? 'block' : 'none';
                }

                if (this.simulator && this.simulator.setMouseInteractionEnabled) {
                    this.simulator.setMouseInteractionEnabled(enabled);
                    this.updateCanvasCursor(enabled);
                }
            });
        }

        // Force strength slider
        const strengthSlider = document.getElementById('mouse-force-strength-slider');
        if (strengthSlider) {
            strengthSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                document.getElementById('mouse-force-strength-value').textContent = value;

                if (this.simulator && this.simulator.setMouseForceParameters) {
                    this.simulator.setMouseForceParameters(value, null);
                }
            });
        }

        // Force radius slider
        const radiusSlider = document.getElementById('mouse-force-radius-slider');
        if (radiusSlider) {
            radiusSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                document.getElementById('mouse-force-radius-value').textContent = value;

                if (this.simulator && this.simulator.setMouseForceParameters) {
                    this.simulator.setMouseForceParameters(null, value);
                }
            });
        }

        // Toggle force type button
        const toggleBtn = document.getElementById('toggle-force-type-btn');
        toggleBtn.addEventListener('click', () => {
            if (this.simulator && this.simulator.mouseInteraction) {
                this.simulator.mouseInteraction.toggleForceType(); // Use the MouseInteraction method
            }
        });


    }

    updateCanvasCursor(enabled) {
        const canvas = document.getElementById('webgpu-canvas');
        if (canvas) {
            if (enabled) {
                //     canvas.style.cursor = 'crosshair';
                //     // canvas.title = 'Mouse interaction enabled - Click to toggle attract/repel';

                this.canvas.style.cursor = 'none';
            } else {
                canvas.style.cursor = 'default';
                canvas.title = '';
            }
        }
    }

    updateToggleButton() {
        const toggleBtn = document.getElementById('toggle-force-type-btn');
        if (toggleBtn && this.simulator && this.simulator.mouseInteraction) {
            if (this.simulator.mouseInteraction.isAttract) {
                toggleBtn.textContent = ' Switch to Repel';
                toggleBtn.className = 'control-btn attract-mode';
            } else {
                toggleBtn.textContent = 'Switch to Attract';
                toggleBtn.className = 'control-btn repel-mode';
            }
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