let simulator;
// Configuration generator functions (from your config file)
function generateColors(numTypes) {
    const colors = [];
    for (let i = 0; i < numTypes; i++) {
        const r = Math.random() * 0.7 + 0.3;
        const g = Math.random() * 0.7 + 0.3;
        const b = Math.random() * 0.7 + 0.3;
        colors.push([r, g, b]);
    }
    return colors;
}

function calculateForce(typeA, typeB, numTypes, forceScale, radius) {
    // Your existing lava lamp formula
    const seed1 = (typeA * 7 + typeB * 13 + numTypes * 3) % 1000;
    const seed2 = (typeA * 11 + typeB * 17 + numTypes * 5) % 1000;
    const random1 = (seed1 * 9301 + 49297) % 233280 / 233280.0;
    const random2 = (seed2 * 4171 + 7919) % 233280 / 233280.0;
    const random3 = (seed1 * 1231 + seed2 * 3571) % 233280 / 233280.0;
    const random4 = (seed2 * 8191 + seed1 * 1597) % 233280 / 233280.0;

    let strength, interactionRadius, collisionStrength, collisionRadius;

    if (typeA === typeB) {
        if (typeA === Math.floor(numTypes * 0.6)) {
            strength = -(40 + random1 * 40) * forceScale;
            interactionRadius = 3 + random2 * 8;
        } else {
            strength = (30 + random1 * 65) * forceScale;
            interactionRadius = 12 + random2 * 18;
        }
    } else {
        const asymmetricSeed = (typeA * 23 + typeB * 41) % 1000;
        const asymmetricRandom = (asymmetricSeed * 6121 + 3571) % 233280 / 233280.0;

        if (asymmetricRandom < 0.52) {
            strength = (25 + random1 * 75) * forceScale;
        } else {
            strength = -(20 + random1 * 80) * forceScale;
        }

        const radiusType = random2;
        if (radiusType < 0.15) {
            interactionRadius = 2.5 + random3 * 5;
        } else if (radiusType < 0.85) {
            interactionRadius = 8 + random3 * 22;
        } else {
            interactionRadius = 28 + random3 * 4;
        }
    }

    const baseCollisionStrength = Math.abs(strength) * (15 + random4 * 10);
    collisionStrength = Math.max(200, baseCollisionStrength + random4 * 800);

    const collisionRatio = 0.15 + random1 * 0.2;
    collisionRadius = Math.max(0.4, interactionRadius * collisionRatio);

    return {
        strength: strength,
        radius: interactionRadius * (radius / 20),
        collisionStrength: collisionStrength,
        collisionRadius: collisionRadius
    };
}

function generateImbalancedPopulations(numTypes) {
    const weights = [];

    if (numTypes === 3) {
        weights.push(0.45, 0.35, 0.20);
    } else if (numTypes === 4) {
        weights.push(0.35, 0.30, 0.25, 0.10);
    } else if (numTypes === 5) {
        weights.push(0.25, 0.28, 0.22, 0.15, 0.10);
    } else if (numTypes === 6) {
        weights.push(0.25, 0.23, 0.18, 0.16, 0.12, 0.06);
    } else {
        for (let i = 0; i < numTypes; i++) {
            weights.push(0.4 / (i + 1));
        }
    }

    const sum = weights.reduce((a, b) => a + b);
    return weights.map(w => w / sum);
}

function generateLavaLampConfiguration(numTypes = 5, numParticles = 12000, forceScale = 1, radius = 20) {
    const colors = generateColors(numTypes);
    const species = [];
    const spawnWeights = generateImbalancedPopulations(numTypes);

    for (let i = 0; i < numTypes; i++) {
        const forces = [];
        for (let j = 0; j < numTypes; j++) {
            forces.push(calculateForce(i, j, numTypes, forceScale, radius));
        }

        species.push({
            color: [...colors[i], 1.0],
            forces: forces,
            spawnWeight: spawnWeights[i]
        });
    }

    return {
        particleCount: numParticles,
        species: species,
        simulationSize: [1200, 750],
        friction: "50",
        centralForce: 0,
        symmetricForces: false,
        particleSize: 0.007,
        particleOpacity: 0.75
    };
}

// Enhanced function to generate and apply new configuration
async function generateAndApplyConfiguration() {
    if (!simulator || !simulator.gpu) {
        console.log("Simulator not ready");
        return;
    }

    try {
        // Get current settings (you can add UI sliders for these)
        const numTypes = simulator.config.numTypes;
        const numParticles = simulator.config.numParticles;
        const forceScale = 1.0; // You can connect this to a slider
        const radius = 20; // You can connect this to a slider

        const newConfig = generateLavaLampConfiguration(numTypes, numParticles, forceScale, radius);
        
        console.log("Generated new configuration with", newConfig.species.length, "types");

        // Apply configuration dynamically
        await simulator.applyNewConfiguration(newConfig);
        
        console.log("✓ New configuration applied successfully!");
        
        // Update any UI elements that show current config
        updateConfigDisplay(newConfig);
        
    } catch (error) {
        console.error("Error generating/applying configuration:", error);
        
        // If dynamic update fails, try full restart
        console.log("Attempting full restart...");
        try {
            await restartWithNewConfiguration();
        } catch (restartError) {
            console.error("Full restart also failed:", restartError);
        }
    }
}

// Function to restart simulator with completely new configuration
async function restartWithNewConfiguration() {
    if (!simulator) return;

    const wasRunning = simulator.isRunning;
    simulator.stop();

    // Generate new configuration with potentially different number of types
    const numTypes = 3 + Math.floor(Math.random() * 4); // 3-6 types
    const numParticles = 8000 + Math.floor(Math.random() * 8000); // 8k-16k particles
    const newConfig = generateLavaLampConfiguration(numTypes, numParticles);

    // Restart simulator with new config
    simulator = new ParticleLifeSimulator('webgpu-canvas', newConfig);
    const initialized = await simulator.initialize();

    if (initialized) {
        syncSlidersWithConfig();
        if (wasRunning) {
            simulator.start();
        }
        updateButtonStates();
        updateConfigDisplay(newConfig);
        console.log("✓ Simulator restarted with new configuration!");
    }
}

// Simple function to just randomize forces (keeping same particle count/types)
async function randomizeForces() {
    if (!simulator || !simulator.gpu) {
        console.log("Simulator not ready");
        return;
    }

    try {
        await simulator.randomizeForces();
        console.log("✓ Forces randomized!");
    } catch (error) {
        console.error("Error randomizing forces:", error);
    }
}

// Enhanced updateConfigDisplay function
function updateConfigDisplay(config) {
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

    display.innerHTML = `
        <strong>Current Configuration:</strong><br>
        • Particle Types: ${config.species.length}<br>
        • Total Particles: ${config.particleCount.toLocaleString()}<br>
        • Antisocial Types: ${antisocialCount}<br>
        • Force Balance: ${attractiveForces} attractive, ${repulsiveForces} repulsive<br>
        • Friction: ${config.friction}<br>
        • Last Updated: ${new Date().toLocaleTimeString()}
    `;
}

// Enhanced keyboard controls
function setupKeyboardControls() {
    document.addEventListener('keydown', (event) => {
        // Prevent default for handled keys
        if (['Space', 'KeyG', 'KeyP', 'KeyR', 'KeyF', 'KeyN'].includes(event.code)) {
            event.preventDefault();
        }

        switch(event.code) {
            case 'Space':
                // Quick force randomization (keeps same particle count/types)
                randomizeForces();
                break;
            case 'KeyG':
                // Generate new configuration (same types, new forces)
                generateAndApplyConfiguration();
                break;
            case 'KeyN':
                // New complete configuration (can change types/particle count)
                restartWithNewConfiguration();
                break;
            case 'KeyF':
                // Just randomize forces (fastest)
                randomizeForces();
                break;
            case 'KeyP':
                if (simulator) {
                    simulator.togglePause();
                    updateButtonStates();
                }
                break;
            case 'KeyR':
                if (simulator) {
                    simulator.reset();
                    updateButtonStates();
                }
                break;
        }
    });
}

// Your existing functions with enhancements
async function startSimulation() {
    try {
        simulator = new ParticleLifeSimulator('webgpu-canvas', {});
        
        const initialized = await simulator.initialize();
        
        if (initialized) {
            console.log("Simulator initialized successfully");
            syncSlidersWithConfig();
            simulator.start();
            updateButtonStates();
        } else {
            console.error("Failed to initialize the particle simulator.");
        }
    } catch (error) {
        console.error("Error starting simulation:", error);
        WebGPUUtils.showError(`Error starting simulation: ${error.message}`);
    }
}

function configureCanvas() {
    const canvas = document.getElementById('webgpu-canvas');
    if (canvas) {
        canvas.width = 1420;
        canvas.height = 750;
        
        fetch('particle-life-system.json')
            .then(response => response.json())
            .then(config => {
                if (config.simulationSize) {
                    canvas.width = config.simulationSize[0];
                    canvas.height = config.simulationSize[1];
                }
            })
            .catch(err => console.log("Using default canvas size"));
    }
}

function updateButtonStates() {
    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const stopBtn = document.getElementById('stop-btn');
    const resetBtn = document.getElementById('reset-btn');
    
    if (!simulator) {
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = true;
        resetBtn.disabled = true;
        if (pauseBtn) {
            pauseBtn.textContent = 'Pause';
            pauseBtn.classList.remove('paused');
        }
        return;
    }
    
    if (!simulator.isRunning) {
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = true;
        resetBtn.disabled = false;
        if (pauseBtn) {
            pauseBtn.textContent = 'Pause';
            pauseBtn.classList.remove('paused');
        }
    } else {
        startBtn.disabled = true;
        pauseBtn.disabled = false;
        stopBtn.disabled = false;
        resetBtn.disabled = false;
        
        if (pauseBtn) {
            if (simulator.isPaused) {
                pauseBtn.textContent = 'Unpause';
                pauseBtn.classList.add('paused');
            } else {
                pauseBtn.textContent = 'Pause';
                pauseBtn.classList.remove('paused');
            }
        }
    }
}

function setupSliders() {
    const frictionSlider = document.getElementById('friction-slider');
    const scaleSlider = document.getElementById('force-scale-slider');
    const sizeSlider = document.getElementById('particle-size-slider');
    const opacitySlider = document.getElementById('particle-opacity-slider');

    if (frictionSlider) {
        if (simulator && simulator.config) {
            frictionSlider.value = simulator.config.friction;
            document.getElementById('friction-value').textContent = simulator.config.friction;
        }
        
        frictionSlider.addEventListener('input', () => {
            document.getElementById('friction-value').textContent = frictionSlider.value;
            updateFriction(parseFloat(frictionSlider.value));
        });
    }

    if (scaleSlider) {
        scaleSlider.addEventListener('input', () => {
            document.getElementById('force-scale-value').textContent = scaleSlider.value;
            updateForceScale(parseFloat(scaleSlider.value));
        });
    }
    
    if (sizeSlider) {
        sizeSlider.addEventListener('input', () => {
            document.getElementById('particle-size-value').textContent = sizeSlider.value;
            updateParticleSize(parseFloat(sizeSlider.value));
        });
    }
    
    if (opacitySlider) {
        opacitySlider.addEventListener('input', () => {
            document.getElementById('particle-opacity-value').textContent = opacitySlider.value;
            updateParticleOpacity(parseFloat(opacitySlider.value));
        });
    }
}

// Your existing update functions
function updateForceScale(scale) {
    if (!simulator || !simulator.config) return;
    
    const { numTypes, strengthMatrix, collisionStrengthMatrix } = simulator.config;
    const scaledStrength = strengthMatrix.map(v => v * scale);
    const scaledCollisionStrength = collisionStrengthMatrix.map(v => v * scale);
    
    if (simulator.gpu && simulator.gpu.device) {
        const device = simulator.gpu.device;
        
        device.queue.writeBuffer(
            simulator.strengthBuffer,
            0,
            new Float32Array(scaledStrength)
        );
        
        device.queue.writeBuffer(
            simulator.collisionStrengthBuffer,
            0,
            new Float32Array(scaledCollisionStrength)
        );
    }
}

function updateFriction(frictionHalfLife) {
    if (!simulator || !simulator.gpu || !simulator.gpu.device) return;
    
    simulator.config.friction = frictionHalfLife;
    const dt = 0.001;
    const friction = Math.exp(-Math.log(2) * dt / (frictionHalfLife * 0.001));
    
    const uniformData = new Float32Array([
        0.02,
        0.15,
        dt,
        friction,
        simulator.config.centralForce || 0.0,
        simulator.config.numTypes || 3
    ]);
    
    simulator.gpu.device.queue.writeBuffer(
        simulator.uniformBuffer,
        0,
        uniformData
    );
}

function updateParticleSize(size) {
    if (simulator && simulator.updateParticleAppearance) {
        const currentOpacity = simulator.config.particleOpacity;
        simulator.updateParticleAppearance(size, currentOpacity);
    }
}

function updateParticleOpacity(opacity) {
    if (simulator && simulator.updateParticleAppearance) {
        const currentSize = simulator.config.particleSize;
        simulator.updateParticleAppearance(currentSize, opacity);
    }
}

function syncSlidersWithConfig() {
    if (!simulator || !simulator.config) return;
    
    const frictionSlider = document.getElementById('friction-slider');
    if (frictionSlider) {
        frictionSlider.value = simulator.config.friction;
        document.getElementById('friction-value').textContent = simulator.config.friction;
    }
    
    const sizeSlider = document.getElementById('particle-size-slider');
    if (sizeSlider) {
        sizeSlider.value = simulator.config.particleSize;
        document.getElementById('particle-size-value').textContent = simulator.config.particleSize;
    }
    
    const opacitySlider = document.getElementById('particle-opacity-slider');
    if (opacitySlider) {
        opacitySlider.value = simulator.config.particleOpacity;
        document.getElementById('particle-opacity-value').textContent = simulator.config.particleOpacity;
    }
    
    console.log("Sliders synced with configuration");
}

// Initialize everything
document.addEventListener('DOMContentLoaded', () => {
    configureCanvas();
    setupSliders();
    setupKeyboardControls();
    
    // Set up event listeners
    document.getElementById('start-btn').addEventListener('click', startSimulation);
    document.getElementById('stop-btn').addEventListener('click', () => {
        if (simulator) {
            simulator.stop();
            updateButtonStates();
        }
    });
    document.getElementById('reset-btn').addEventListener('click', () => {
        if (simulator) {
            simulator.reset();
            updateButtonStates();
        }
    });

    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
            if (simulator) {
                simulator.togglePause();
                updateButtonStates();
            }
        });
    }

    // Save configuration buttons
    const saveConfigBtn = document.getElementById('save-config-btn');
    if (saveConfigBtn) {
        saveConfigBtn.addEventListener('click', () => {
        saveCurrentConfiguration();
        });
    }

    const copyConfigBtn = document.getElementById('copy-config-btn');
    if (copyConfigBtn) {
       copyConfigBtn.addEventListener('click', () => {
           copyConfigurationToClipboard();
       });
    }

   
    // Add new button event listeners
    const generateBtn = document.getElementById('generate-btn');
    if (generateBtn) {
        generateBtn.addEventListener('click', async () => {
            generateBtn.disabled = true;
            generateBtn.textContent = 'Generating...';
            
            try {
                await generateAndApplyConfiguration();
                generateBtn.textContent = '✓ Generated!';
                setTimeout(() => {
                    generateBtn.textContent = 'Generate New Config';
                    generateBtn.disabled = false;
                }, 1000);
            } catch (error) {
                generateBtn.textContent = '✗ Error';
                setTimeout(() => {
                    generateBtn.textContent = 'Generate New Config';
                    generateBtn.disabled = false;
                }, 2000);
            }
        });
    }
    const randomizeBtn = document.getElementById('randomize-btn');
    if (randomizeBtn) {
        randomizeBtn.addEventListener('click', async () => {
            randomizeBtn.disabled = true;
            randomizeBtn.textContent = 'Randomizing...';
            
            try {
                await randomizeForces();
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
        });
    }
    const newConfigBtn = document.getElementById('new-config-btn');
    if (newConfigBtn) {
        newConfigBtn.addEventListener('click', async () => {
            newConfigBtn.disabled = true;
            newConfigBtn.textContent = 'Creating New...';
            
            try {
                await restartWithNewConfiguration();
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
        });
    }
    // Enhanced keyboard controls with visual feedback
function setupKeyboardControls() {
    let isProcessing = false;

    document.addEventListener('keydown', async (event) => {
        if (isProcessing) return; // Prevent rapid-fire key presses

        // Prevent default for handled keys
        if (['Space', 'KeyG', 'KeyP', 'KeyR', 'KeyF', 'KeyN'].includes(event.code)) {
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

            switch(event.code) {
                case 'Space':
                    showFeedback('🎲 Randomizing Forces...', '#FF9800');
                    await randomizeForces();
                    break;
                case 'KeyG':
                    showFeedback('🔄 Generating New Config...', '#28a745');
                    await generateAndApplyConfiguration();
                    break;
                case 'KeyN':
                    showFeedback('✨ Creating New Complete Config...', '#9C27B0');
                    await restartWithNewConfiguration();
                    break;
                case 'KeyF':
                    showFeedback('⚡ Fast Force Randomization...', '#FF9800');
                    await randomizeForces();
                    break;
                case 'KeyP':
                    if (simulator) {
                        simulator.togglePause();
                        updateButtonStates();
                        showFeedback(simulator.isPaused ? '⏸️ Paused' : '▶️ Resumed', '#2196F3');
                    }
                    break;
                case 'KeyR':
                    if (simulator) {
                        simulator.reset();
                        updateButtonStates();
                        showFeedback('🔄 Reset', '#2196F3');
                    }
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

// Add CSS for the feedback animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Enhanced generateAndApplyConfiguration with better error handling
async function generateAndApplyConfiguration() {
    if (!simulator || !simulator.gpu) {
        throw new Error("Simulator not ready");
    }

    try {
        // Get current settings
        const numTypes = simulator.config.numTypes;
        const numParticles = simulator.config.numParticles;
        const forceScale = 1.0;
        const radius = 20;

        const newConfig = generateLavaLampConfiguration(numTypes, numParticles, forceScale, radius);
        
        console.log("Generated new configuration with", newConfig.species.length, "types");

        // Apply configuration dynamically
        await simulator.applyNewConfiguration(newConfig);
        
        console.log("✓ New configuration applied successfully!");
        
        // Update display
        updateConfigDisplay(newConfig);
        
        return newConfig;
        
    } catch (error) {
        console.error("Error generating/applying configuration:", error);
        throw error;
    }
}
    // ADD these functions to your main.js file

// Method 1: Save current configuration to file
function saveCurrentConfiguration() {
    if (!simulator || !simulator.config) {
        console.log("No configuration to save");
        return;
    }

    // Create a configuration object in the same format as your JSON
    const configToSave = {
        particleCount: simulator.config.numParticles,
        species: simulator.config.species,
        simulationSize: simulator.config.simulationSize || [1420, 750],
        friction: simulator.config.friction.toString(),
        centralForce: simulator.config.centralForce || 0,
        symmetricForces: simulator.config.symmetricForces || false,
        particleSize: simulator.config.particleSize,
        particleOpacity: simulator.config.particleOpacity
    };

    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `particle-config-${timestamp}.json`;

    // Create and download the file
    const blob = new Blob([JSON.stringify(configToSave, null, 2)], { 
        type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`Configuration saved as ${filename}`);
    
    // Update the display to show it was saved
    const display = document.getElementById('config-display');
    if (display) {
        const originalText = display.innerHTML;
        display.innerHTML = `<strong style="color: green;">✓ Configuration saved as ${filename}</strong>`;
        setTimeout(() => {
            display.innerHTML = originalText;
        }, 3000);
    }
}

// Method 2: Copy configuration to clipboard
function copyConfigurationToClipboard() {
    if (!simulator || !simulator.config) {
        console.log("No configuration to copy");
        return;
    }

    const configToSave = {
        particleCount: simulator.config.numParticles,
        species: simulator.config.species,
        simulationSize: simulator.config.simulationSize || [1420, 750],
        friction: simulator.config.friction.toString(),
        centralForce: simulator.config.centralForce || 0,
        symmetricForces: simulator.config.symmetricForces || false,
        particleSize: simulator.config.particleSize,
        particleOpacity: simulator.config.particleOpacity
    };

    const jsonString = JSON.stringify(configToSave, null, 2);

    navigator.clipboard.writeText(jsonString).then(() => {
        console.log("Configuration copied to clipboard!");
        
        // Show feedback
        const display = document.getElementById('config-display');
        if (display) {
            const originalText = display.innerHTML;
            display.innerHTML = `<strong style="color: blue;">📋 Configuration copied to clipboard!</strong>`;
            setTimeout(() => {
                display.innerHTML = originalText;
            }, 2000);
        }
    }).catch(err => {
        console.error('Failed to copy configuration: ', err);
    });
}


    // Start simulation immediately
    startSimulation();
});