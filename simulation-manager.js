/**
 * Updated Simulation Manager with Responsive Canvas Support
 */

class SimulationManager {
    constructor() {
        this.simulator = null;
        this.forceParams = {
            strengthModifier: 110,
            radiusRange: 25,
            collisionStrengthRange: 750,
            collisionRadiusRange: 5
        };
        this.responsiveSystem = null;
        this.uiController = null;
        this.configGenerator = null;
    }

    /**
     * Initialize the simulation manager with responsive canvas
     */
    async initialize() {
        try {
            // console.log("Initializing Simulation Manager with responsive support...");

            // Initialize responsive canvas system first
            this.responsiveSystem = new ResponsiveCanvasSystem();
            this.responsiveSystem.initialize();

            // Configure canvas with responsive sizing
            this.configureCanvas();

            // Start simulation
            await this.startSimulation();

            // Connect responsive system to simulator
            if (this.simulator) {
                this.responsiveSystem.setSimulator(this.simulator);
                this.responsiveSystem.updateSimulationConfig();

                // Apply device-specific optimizations
                this.applyDeviceOptimizations();
            }

            console.log("✓ Simulation Manager with responsive support initialized successfully");
            return true;
        } catch (error) {
            console.error("Failed to initialize Simulation Manager:", error);
            return false;
        }
    }

    /**
     * Configure canvas with responsive sizing
     */
    configureCanvas() {
        if (this.responsiveSystem) {
            // Let responsive system handle sizing
            this.responsiveSystem.applyCanvasSize();

            const currentSize = this.responsiveSystem.getCurrentSize();
            console.log(`Canvas configured: ${currentSize.width}x${currentSize.height}`);
            // console.log(`Device category: ${this.responsiveSystem.getDeviceCategory()}`);
        } else {
            // Fallback to default sizing
            this.configureFallbackCanvas();
        }
    }

    /**
     * Fallback canvas configuration if responsive system fails
     */
    configureFallbackCanvas() {
        const canvas = document.getElementById('webgpu-canvas');
        if (!canvas) return;

        // Try to load from JSON first
        fetch('particle-life-system.json')
            .then(response => response.json())
            .then(config => {
                if (config.simulationSize) {
                    canvas.width = config.simulationSize[0];
                    canvas.height = config.simulationSize[1];
                    console.log(`Canvas set to ${config.simulationSize[0]}x${config.simulationSize[1]} from JSON`);
                } else {
                    // Use screen-based fallback
                    const fallbackWidth = Math.min(window.innerWidth - 300, 1200);
                    const fallbackHeight = Math.min(window.innerHeight - 100, 800);
                    canvas.width = fallbackWidth;
                    canvas.height = fallbackHeight;
                    console.log(`Canvas set to fallback size: ${fallbackWidth}x${fallbackHeight}`);
                }
            })
            .catch(err => {
                // Final fallback
                canvas.width = Math.min(window.innerWidth - 300, 1000);
                canvas.height = Math.min(window.innerHeight - 100, 800);
                console.log("Using final fallback canvas size");
            });
    }

    /**
     * Apply device-specific optimizations
     */
    applyDeviceOptimizations() {
        if (!this.responsiveSystem) return;

        const deviceInfo = this.responsiveSystem.applyDeviceOptimizations();
        // console.log('Applying device optimizations:', deviceInfo);

        // Adjust particle count based on screen size and device capability
        const recommendedParticles = deviceInfo.recommendedParticles;

        if (this.simulator && this.simulator.config) {
            const currentParticles = this.simulator.config.numParticles;

            // Only auto-adjust if the difference is significant
            const ratio = recommendedParticles / currentParticles;
            if (ratio < 0.7 || ratio > 1.3) {
                console.log(`Recommending particle count adjustment: ${currentParticles} → ${recommendedParticles}`);

                // this.updateParticleCount(recommendedParticles);
            }
        }

        // // Device-specific quality settings
        // switch (deviceInfo.category) {
        //     case 'mobile':
        //         console.log('Mobile device detected - consider lower particle counts and simpler effects');
        //         break;
        //     case 'tablet':
        //         console.log('Tablet device detected - balanced settings recommended');
        //         break;
        //     case 'desktop':
        //         console.log('Desktop device detected - full quality available');
        //         break;
        //     case 'large-desktop':
        //         console.log('Large desktop detected - maximum quality and particle counts supported');
        //         break;
        // }

        return deviceInfo;
    }

    /**
     * Handle window resize events
     */
    onWindowResize() {
        if (this.responsiveSystem) {
            this.responsiveSystem.applyCanvasSize();

            if (this.simulator) {
                // Update simulator's aspect ratio
                this.simulator.updateAspectRatio();
            }
        }
    }

    /**
     * Force a specific canvas size (for testing)
     */
    setCanvasSize(width, height) {
        if (this.responsiveSystem) {
            this.responsiveSystem.setSize(width, height);

            if (this.simulator) {
                this.simulator.updateAspectRatio();
            }
        }
    }

    /**
     * Get current canvas information
     */
    getCanvasInfo() {
        if (this.responsiveSystem) {
            return this.responsiveSystem.getCurrentSize();
        }

        const canvas = document.getElementById('webgpu-canvas');
        return canvas ? {
            width: canvas.width,
            height: canvas.height,
            aspectRatio: canvas.width / canvas.height
        } : null;
    }

    /**
     * Randomize forces in the current simulation
     */
    async randomizeForces() {
        if (!this.simulator || !this.simulator.gpu) {
            console.log("Simulator not ready");
            return;
        }

        try {
            // Get current force scale from slider
            const forceScale = parseFloat(document.getElementById('force-scale-slider').value) || 1.0;
            
            // Create force params with specific values for radius and collision radius
            const forceParams = {
                strengthModifier: 110,
                radiusRange: 32,  //22 Specific value for radius when randomizing
                collisionStrengthRange: 750,
                collisionRadiusRange: 6,  //5.5 Specific value for collision radius when randomizing
                forceScale: forceScale
            };
            
            await this.simulator.randomizeForces(forceParams);
            console.log("✓ Forces randomized with custom parameters and force scale:", forceScale);
        } catch (error) {
            console.error("Error randomizing forces:", error);
        }
    }

    /**
     * Restart simulation with a completely new configuration
     */
    async restartWithNewConfiguration() {
        if (!this.simulator) return;

        // console.log("=== CREATING NEW COMPLETE CONFIGURATION ===");

        const wasRunning = this.simulator.isRunning;
        if (this.simulator.isRunning) {
            this.simulator.stop();
        }

        try {
            // Get current canvas size for the new config
            const canvasInfo = this.getCanvasInfo();
            // console.log('Using canvas size for new config:', canvasInfo);

            // Get custom parameters from UI sliders
            const numTypes = parseInt(document.getElementById('particle-types-slider').value) || 5;
            const numParticles = parseInt(document.getElementById('total-particles-slider').value) || 12000;
            const centralForce = document.getElementById('central-force-checkbox').checked ? 1 : 0;
            const loopingBorders = document.getElementById('looping-borders-checkbox').checked ? 1 : 0;
            const friction = parseFloat(document.getElementById('friction-slider').value) || 50;
            const forceScale = parseFloat(document.getElementById('force-scale-slider').value) || 1.0;
            const particleSize = parseFloat(document.getElementById('particle-size-slider').value) || 0.007;
            const particleOpacity = parseFloat(document.getElementById('particle-opacity-slider').value) || 0.75;

            // Use device-optimized particle count if responsive system suggests it
            let finalParticleCount = numParticles;
            if (this.responsiveSystem) {
                const recommendedCount = this.responsiveSystem.getRecommendedParticleCount();
                if (numParticles > recommendedCount) {
                    finalParticleCount = recommendedCount;
                    // Update the slider to reflect the actual count used
                    document.getElementById('total-particles-slider').value = finalParticleCount;
                    document.getElementById('total-particles-value').textContent = finalParticleCount;
                }
            }

            const radius = 15 + Math.random() * 10; // 15-25 radius

            // console.log("Generating new lava lamp configuration:", {
            //     numTypes,
            //     numParticles: finalParticleCount,
            //     centralForce,
            //     loopingBorders,
            //     forceScale,
            //     radius,
            //     canvasSize: canvasInfo
            // });

            // Generate the new configuration
            const newConfig = this.generateLavaLampConfiguration(numTypes, finalParticleCount, forceScale, radius, friction, particleSize, particleOpacity);
            
            // Add custom parameters to the config
            newConfig.centralForce = centralForce;
            newConfig.loopingBorders = loopingBorders;
            newConfig.friction = friction;
            newConfig.particleSize = particleSize;
            newConfig.particleOpacity = particleOpacity;

            // Update simulation size to match current canvas
            if (canvasInfo) {
                newConfig.simulationSize = [canvasInfo.width, canvasInfo.height];
            }

            // console.log("Generated config:", {
            //     particleCount: newConfig.particleCount,
            //     speciesCount: newConfig.species.length,
            //     simulationSize: newConfig.simulationSize
            // });

            // Create brand new simulator with the generated config
            this.simulator = new ParticleLifeSimulator('webgpu-canvas', newConfig);

            // console.log("Initializing new simulator...");
            const initialized = await this.simulator.initialize();

            if (initialized) {
                // console.log("New simulator initialized successfully!");

                // Reconnect responsive system
                if (this.responsiveSystem) {
                    this.responsiveSystem.setSimulator(this.simulator);
                    this.responsiveSystem.updateSimulationConfig();
                }

                // Store baseline and update UI
                this.simulator.storeCurrentAsBaseline();
                this.syncSlidersWithConfig();
                this.updateConfigDisplay(newConfig);

                // Reset force parameter sliders to default values for new configurations
                const radiusSlider = document.getElementById('radius-range-slider');
                const collisionRadiusSlider = document.getElementById('collision-radius-range-slider');
                
                if (radiusSlider) {
                    radiusSlider.value = 25; // Default value for new configurations
                    document.getElementById('radius-range-value').textContent = '25';
                }
                
                if (collisionRadiusSlider) {
                    collisionRadiusSlider.value = 4; // Default value for new configurations
                    document.getElementById('collision-radius-range-value').textContent = '4';
                }

                // Update UI controller's forceParams if available
                if (this.uiController && this.uiController.forceParams) {
                    this.uiController.forceParams.radiusRange = 25;
                    this.uiController.forceParams.collisionRadiusRange = 4;
                }

                // Start if it was running before
                if (wasRunning) {
                    this.simulator.start();
                }
                this.updateButtonStates();

                console.log("✓ New complete configuration created and running!");
                return true;

            } else {
                throw new Error("Failed to initialize new simulator");
            }

        } catch (error) {
            console.error("Error creating new configuration:", error);
            // Fallback handling...
            return false;
        }
    }

    /**
     * Create custom simulation from current slider values
     */
    async createCustomSimulation() {
        if (!this.simulator) return;

        const wasRunning = this.simulator.isRunning;
        if (this.simulator.isRunning) {
            this.simulator.stop();
        }

        try {
            // Get current canvas size for the new config
            const canvasInfo = this.getCanvasInfo();

            // Get custom parameters from UI sliders and checkboxes
            const numTypes = parseInt(document.getElementById('particle-types-slider').value) || 5;
            const numParticles = parseInt(document.getElementById('total-particles-slider').value) || 12000;
            const centralForce = document.getElementById('central-force-checkbox').checked ? 1 : 0;
            const loopingBorders = document.getElementById('looping-borders-checkbox').checked ? 1 : 0;
            const friction = parseFloat(document.getElementById('friction-slider').value) || 50;
            const forceScale = parseFloat(document.getElementById('force-scale-slider').value) || 1.0;
            const particleSize = parseFloat(document.getElementById('particle-size-slider').value) || 0.007;
            const particleOpacity = parseFloat(document.getElementById('particle-opacity-slider').value) || 0.75;

            // Use device-optimized particle count if responsive system suggests it
            let finalParticleCount = numParticles;
            if (this.responsiveSystem) {
                const recommendedCount = this.responsiveSystem.getRecommendedParticleCount();
                if (numParticles > recommendedCount) {
                    finalParticleCount = recommendedCount;
                    // Update the slider to reflect the actual count used
                    document.getElementById('total-particles-slider').value = finalParticleCount;
                    document.getElementById('total-particles-value').textContent = finalParticleCount;
                }
            }

            // Use current force parameters instead of random ones
            const radius = 20; // Use default radius

            console.log("Creating custom simulation:", {
                numTypes,
                numParticles: finalParticleCount,
                centralForce,
                loopingBorders,
                forceScale,
                radius,
                canvasSize: canvasInfo
            });

            // Generate the custom configuration
            const newConfig = this.generateLavaLampConfiguration(numTypes, finalParticleCount, forceScale, radius, friction, particleSize, particleOpacity);
            
            // Add custom parameters to the config
            newConfig.centralForce = centralForce;
            newConfig.loopingBorders = loopingBorders;
            newConfig.friction = friction;
            newConfig.particleSize = particleSize;
            newConfig.particleOpacity = particleOpacity;

            // Update simulation size to match current canvas
            if (canvasInfo) {
                newConfig.simulationSize = [canvasInfo.width, canvasInfo.height];
            }

            // Create brand new simulator with the custom config
            this.simulator = new ParticleLifeSimulator('webgpu-canvas', newConfig);

            const initialized = await this.simulator.initialize();

            if (initialized) {
                // Reconnect responsive system
                if (this.responsiveSystem) {
                    this.responsiveSystem.setSimulator(this.simulator);
                    this.responsiveSystem.updateSimulationConfig();
                }

                // Store baseline and update UI
                this.simulator.storeCurrentAsBaseline();
                this.syncSlidersWithConfig();
                this.updateConfigDisplay(newConfig);

                // Reset force parameter sliders to default values for new configurations
                const radiusSlider = document.getElementById('radius-range-slider');
                const collisionRadiusSlider = document.getElementById('collision-radius-range-slider');
                
                if (radiusSlider) {
                    radiusSlider.value = 25; // Default value for new configurations
                    document.getElementById('radius-range-value').textContent = '25';
                }
                
                if (collisionRadiusSlider) {
                    collisionRadiusSlider.value = 4; // Default value for new configurations
                    document.getElementById('collision-radius-range-value').textContent = '4';
                }

                // Update UI controller's forceParams if available
                if (this.uiController && this.uiController.forceParams) {
                    this.uiController.forceParams.radiusRange = 25;
                    this.uiController.forceParams.collisionRadiusRange = 4;
                }

                // Start if it was running before
                if (wasRunning) {
                    this.simulator.start();
                }
                this.updateButtonStates();

                console.log("✓ Custom simulation created and running!");
                return true;

            } else {
                throw new Error("Failed to initialize custom simulator");
            }

        } catch (error) {
            console.error("Error creating custom simulation:", error);
            return false;
        }
    }

    /**
     * Load and apply a configuration from file
     * @param {Object} config - The configuration object to load
     */
    async loadConfiguration(config) {
        if (!this.simulator) {
            console.error("Simulator not initialized");
            throw new Error("Simulator not initialized");
        }

        try {
            console.log("Loading configuration:", config);

            const wasRunning = this.simulator.isRunning;
            if (this.simulator.isRunning) {
                this.simulator.stop();
            }

            // Check if we need to restart the simulator (different number of types)
            const currentTypes = this.simulator.config.numTypes;
            const newTypes = config.species.length;
            
            if (currentTypes !== newTypes) {
                console.log(`Type count changed from ${currentTypes} to ${newTypes}, restarting simulator...`);
                
                // Show user feedback about the restart
                const display = document.getElementById('config-display');
                if (display) {
                    const originalText = display.innerHTML;
                    display.innerHTML = `<strong style="color: blue;">🔄 Restarting simulator for ${newTypes} particle types...</strong>`;
                    
                    // Create a new simulator with the loaded configuration
                    this.simulator = new ParticleLifeSimulator('webgpu-canvas', config);
                    const initialized = await this.simulator.initialize();
                    
                    if (!initialized) {
                        display.innerHTML = `<strong style="color: red;">✗ Failed to initialize simulator</strong>`;
                        setTimeout(() => {
                            display.innerHTML = originalText;
                        }, 3000);
                        throw new Error("Failed to initialize new simulator with loaded configuration");
                    }
                    
                    // Restore original display after successful restart
                    setTimeout(() => {
                        display.innerHTML = originalText;
                    }, 1000);
                } else {
                    // Create a new simulator with the loaded configuration
                    this.simulator = new ParticleLifeSimulator('webgpu-canvas', config);
                    const initialized = await this.simulator.initialize();
                    
                    if (!initialized) {
                        throw new Error("Failed to initialize new simulator with loaded configuration");
                    }
                }
            } else {
                // Same number of types, can update in place
                await this.simulator.applyNewConfiguration(config);
            }

            // Reconnect responsive system
            if (this.responsiveSystem) {
                this.responsiveSystem.setSimulator(this.simulator);
                this.responsiveSystem.updateSimulationConfig();
            }

            // Store the loaded configuration as baseline for force modifications
            this.simulator.storeCurrentAsBaseline();

            // Update UI
            this.syncSlidersWithConfig();
            this.updateConfigDisplay(config);
            this.updateButtonStates();

            // Start if it was running before
            if (wasRunning) {
                this.simulator.start();
            }

            console.log("✓ Configuration loaded and applied successfully!");
            return true;

        } catch (error) {
            console.error("Error loading configuration:", error);
            throw error;
        }
    }

    getSimulator() {
        return this.simulator;
    }

    getConfigGenerator() {
        if (!this.configGenerator) {
            this.configGenerator = new ConfigGenerator();
        }
        return this.configGenerator;
    }

    getUIController() {
        if (!this.uiController) {
            this.uiController = {
                updateButtonStates: this.updateButtonStates.bind(this),
                syncSlidersWithConfig: this.syncSlidersWithConfig.bind(this),
                updateConfigDisplay: this.updateConfigDisplay.bind(this)
            };
        }
        return this.uiController;
    }

    generateLavaLampConfiguration(numTypes = 5, numParticles = 12000, forceScale = 1, radius = 20, friction = 50, particleSize = 0.007, particleOpacity = 0.75) {
        const generator = this.getConfigGenerator();
        return generator.generateLavaLampConfiguration(numTypes, numParticles, forceScale, radius, friction, particleSize, particleOpacity);
    }

    // Helper methods for UI management (keeping existing methods)
    async startSimulation() {
        try {
            this.simulator = new ParticleLifeSimulator('webgpu-canvas', {});

            const initialized = await this.simulator.initialize();

            if (initialized) {
                console.log("Simulator initialized successfully");

                // Connect to responsive system
                if (this.responsiveSystem) {
                    this.responsiveSystem.setSimulator(this.simulator);
                    this.responsiveSystem.updateSimulationConfig();
                }

                this.syncSlidersWithConfig();
                this.simulator.start();
                // this.simulator.pause(); // Start paused by default
                this.updateButtonStates();
            } else {
                console.error("Failed to initialize the particle simulator.");
            }
        } catch (error) {
            console.error("Error starting simulation:", error);
            WebGPUUtils.showError(`Error starting simulation: ${error.message}`);
        }
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

        // Get current canvas info from responsive system
        const canvasInfo = this.getCanvasInfo();
        const aspectRatio = canvasInfo ? canvasInfo.aspectRatio.toFixed(2) : 'Unknown';
        const canvasSize = canvasInfo ?
            `${canvasInfo.width}×${canvasInfo.height}` :
            (config.simulationSize ? `${config.simulationSize[0]}×${config.simulationSize[1]}` : 'Unknown');

        // Get device category for additional info
        const deviceCategory = this.responsiveSystem ? this.responsiveSystem.getDeviceCategory() : 'Unknown';

        display.innerHTML = `
            <strong>Current Configuration:</strong><br>
            • Particle Types: ${config.species.length}<br>
            • Total Particles: ${config.particleCount.toLocaleString()}<br>
            • Canvas Size: ${canvasSize}<br>
            • Aspect Ratio: ${aspectRatio}:1<br>
            • Device: ${deviceCategory}<br>
            • Particle Size: ${config.particleSize || 'Default'}<br>
            • Antisocial Types: ${antisocialCount}<br>
            • Force Balance: ${attractiveForces} attractive, ${repulsiveForces} repulsive<br>
            • Friction: ${config.friction}<br>
            • Last Updated: ${new Date().toLocaleTimeString()}
        `;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimulationManager;
} else {
    // Make available globally for browser use
    window.SimulationManager = SimulationManager;
}