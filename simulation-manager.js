/**
 * Simulation Manager for Particle Life Simulator
 * Manages the simulation lifecycle, configuration, and UI coordination
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
     * Initialize the simulation manager
     */
    async initialize() {
        try {
            console.log("Initializing Simulation Manager...");
            
            // Configure canvas
            this.configureCanvas();
            
            // Start simulation
            await this.startSimulation();
            
            console.log("Simulation Manager initialized successfully");
            return true;
        } catch (error) {
            console.error("Failed to initialize Simulation Manager:", error);
            return false;
        }
    }


  configureCanvas() {
    const canvas = document.getElementById('webgpu-canvas');
    if (canvas) {
        // Try to load from JSON first
        fetch('particle-life-system.json')
            .then(response => response.json())
            .then(config => {
                if (config.simulationSize) {
                    canvas.width = config.simulationSize[0];
                    canvas.height = config.simulationSize[1];
                    console.log(`Canvas set to ${config.simulationSize[0]}x${config.simulationSize[1]} from JSON`);
                } else {
                    // Fallback to defaults
                    canvas.width = 1000;
                    canvas.height = 800;
                    console.log('Using default canvas size');
                }
            })
            .catch(err => {
                // Fallback if no JSON file
                canvas.width = 1000;
                canvas.height = 800;
                console.log("No JSON file found, using default canvas size");
            });
    }
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
            await this.simulator.randomizeForces(this.forceParams);
            console.log("✓ Forces randomized with custom parameters!");
        } catch (error) {
            console.error("Error randomizing forces:", error);
        }
    }

    /**
     * Restart simulation with a completely new configuration
     */
    async restartWithNewConfiguration() {
        if (!this.simulator) return;

        console.log("=== CREATING NEW COMPLETE CONFIGURATION ===");

        const wasRunning = this.simulator.isRunning;
        if (this.simulator.isRunning) {
            this.simulator.stop();
        }

        try {
            // Generate completely new configuration with random parameters
            const numTypes = 3 + Math.floor(Math.random() * 4); // 3-6 types
            const numParticles = 8000 + Math.floor(Math.random() * 3000); // 8k-16k particles
            const forceScale = 1 + Math.random() * 0.9; // 0.8-1.2 scale
            const radius = 15 + Math.random() * 10; // 15-25 radius

            console.log("Generating new lava lamp configuration:", {
                numTypes,
                numParticles,
                forceScale,
                radius
            });

            // Generate the new configuration using lava lamp function
            const newConfig = this.generateLavaLampConfiguration(numTypes, numParticles, forceScale, radius);

            console.log("Generated config:", {
                particleCount: newConfig.particleCount,
                speciesCount: newConfig.species.length,
                firstSpeciesColor: newConfig.species[0].color,
                firstForce: newConfig.species[0].forces[0]
            });

            // Create a completely new simulator instance
            console.log("Creating new simulator instance...");

            // Destroy the old simulator first
            if (this.simulator && this.simulator.gpu) {
                this.simulator.stop();
            }

            // Create brand new simulator with the generated config
            this.simulator = new ParticleLifeSimulator('webgpu-canvas', newConfig);

            console.log("Initializing new simulator...");
            const initialized = await this.simulator.initialize();

            if (initialized) {
                console.log("New simulator initialized successfully!");

                // Automatically store the new config as baseline for modifications
                this.simulator.storeCurrentAsBaseline();

                // Update UI
                this.syncSlidersWithConfig();
                this.updateConfigDisplay(newConfig);

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

            // Fallback: try to create a basic working config
            console.log("Attempting fallback configuration...");
            try {
                const fallbackConfig = this.generateLavaLampConfiguration(4, 10000, 1.0, 20);
                console.log("Fallback config generated:", fallbackConfig);

                this.simulator = new ParticleLifeSimulator('webgpu-canvas', fallbackConfig);
                const initialized = await this.simulator.initialize();

                if (initialized) {
                    this.simulator.storeCurrentAsBaseline();
                    this.syncSlidersWithConfig();
                    this.updateConfigDisplay(fallbackConfig);
                    if (wasRunning) {
                        this.simulator.start();
                    }
                    this.updateButtonStates();
                    console.log("✓ Fallback configuration created successfully");
                    return true;
                }
            } catch (fallbackError) {
                console.error("Even fallback failed:", fallbackError);

                // Last resort: restart with default JSON
                console.log("Last resort: restarting with default configuration");
                try {
                    this.simulator = new ParticleLifeSimulator('webgpu-canvas', {});
                    const initialized = await this.simulator.initialize();
                    if (initialized) {
                        this.simulator.storeCurrentAsBaseline();
                        this.syncSlidersWithConfig();
                        if (wasRunning) {
                            this.simulator.start();
                        }
                        this.updateButtonStates();
                    }
                } catch (lastResortError) {
                    console.error("Complete failure:", lastResortError);
                    WebGPUUtils.showError("Failed to create new configuration");
                }
            }
            return false;
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

    generateLavaLampConfiguration(numTypes = 5, numParticles = 12000, forceScale = 1, radius = 20) {
        const generator = this.getConfigGenerator();
        return generator.generateLavaLampConfiguration(numTypes, numParticles, forceScale, radius);
    }

  
    // Helper methods for UI management
    async startSimulation() {
        try {
            this.simulator = new ParticleLifeSimulator('webgpu-canvas', {});

            const initialized = await this.simulator.initialize();

            if (initialized) {
                console.log("Simulator initialized successfully");
                this.syncSlidersWithConfig();
                this.simulator.start();
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
        const startBtn = document.getElementById('start-btn');
        const pauseBtn = document.getElementById('pause-btn');
        // const stopBtn = document.getElementById('stop-btn');
        const resetBtn = document.getElementById('reset-btn');

        if (!this.simulator) {
            startBtn.disabled = false;
            pauseBtn.disabled = true;
            // stopBtn.disabled = true;
            resetBtn.disabled = true;
            if (pauseBtn) {
                pauseBtn.textContent = 'Pause';
                pauseBtn.classList.remove('paused');
            }
            return;
        }

        if (!this.simulator.isRunning) {
            startBtn.disabled = false;
            pauseBtn.disabled = true;
            // stopBtn.disabled = true;
            resetBtn.disabled = false;
            if (pauseBtn) {
                pauseBtn.textContent = 'Pause';
                pauseBtn.classList.remove('paused');
            }
        } else {
            startBtn.disabled = true;
            pauseBtn.disabled = false;
            // stopBtn.disabled = false;
            resetBtn.disabled = false;

            if (pauseBtn) {
                if (this.simulator.isPaused) {
                    pauseBtn.textContent = 'Unpause';
                    pauseBtn.classList.add('paused');
                } else {
                    pauseBtn.textContent = 'Pause';
                    pauseBtn.classList.remove('paused');
                }
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

        console.log("Sliders synced with configuration");
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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimulationManager;
} else {
    // Make available globally for browser use
    window.SimulationManager = SimulationManager;
}

