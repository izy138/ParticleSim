let simulator;


async function startSimulation() {
    try {
        simulator = new ParticleLifeSimulator('webgpu-canvas', {});
        
        const initialized = await simulator.initialize();
        
        if (initialized) {
            console.log("Simulator initialized successfully");
            // setupDebugMonitoring();
            
            // ADDED: Sync sliders with loaded config values
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



// // FIXED: Set up debug monitoring in a separate function
// function setupDebugMonitoring() {
//     if (!simulator || !simulator.render) {
//         console.warn("Cannot set up debug monitoring - simulator not ready");
//         return;
//     }
    
//     // Add debug monitoring to see if compute shader is working
//     let frameCount = 0;
//     const originalRender = simulator.render.bind(simulator); // FIXED: Properly bind the context
    
//     simulator.render = function() {
//         frameCount++;
//         if (frameCount % 60 === 0) {
//             console.log(`Frame ${frameCount} - Buffer index: ${this.bufferIndex}`);
//         }
//         originalRender();
//     };
// }

// Configure the canvas size based on simulation size
function configureCanvas() {
    const canvas = document.getElementById('webgpu-canvas');
    if (canvas) {
        // Set default size
        canvas.width = 1420;
        canvas.height = 750;
        
        // Optionally, load configuration to get proper size
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

document.addEventListener('DOMContentLoaded', () => {
    // Configure canvas size first
    configureCanvas();
    setupSliders();
    
     // Set up event listeners
     document.getElementById('start-btn').addEventListener('click', startSimulation);
     document.getElementById('stop-btn').addEventListener('click', () => {
         if (simulator) {
             simulator.stop();
             updateButtonStates();  // NEW: Update button states
         }
     });
     document.getElementById('reset-btn').addEventListener('click', () => {
         if (simulator) {
             simulator.reset();
             updateButtonStates();  // NEW: Update button states
         }
     });
 
     // NEW: Pause button event listener
     document.getElementById('pause-btn').addEventListener('click', () => {
         if (simulator) {
             simulator.togglePause();
             updateButtonStates();
         }
     });
    
    // Start simulation immediately
    startSimulation();
});

function updateButtonStates() {
    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const stopBtn = document.getElementById('stop-btn');
    const resetBtn = document.getElementById('reset-btn');
    
    if (!simulator) {
        // No simulator - only start enabled
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = true;
        resetBtn.disabled = true;
        pauseBtn.textContent = 'Pause';
        pauseBtn.classList.remove('paused');
        return;
    }
    
    if (!simulator.isRunning) {
        // Simulation stopped
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = true;
        resetBtn.disabled = false;
        pauseBtn.textContent = 'Pause';
        pauseBtn.classList.remove('paused');
    } else {
        // Simulation running
        startBtn.disabled = true;
        pauseBtn.disabled = false;
        stopBtn.disabled = false;
        resetBtn.disabled = false;
        
        // Update pause button text and style
        if (simulator.isPaused) {
            pauseBtn.textContent = 'Unpause';
            pauseBtn.classList.add('paused');
        } else {
            pauseBtn.textContent = 'Pause';
            pauseBtn.classList.remove('paused');
        }
    }
}

function setupSliders() {
    const frictionSlider = document.getElementById('friction-slider');
    const centralSlider = document.getElementById('central-slider');
    const scaleSlider = document.getElementById('force-scale-slider');
    const sizeSlider = document.getElementById('particle-size-slider');
    const opacitySlider = document.getElementById('particle-opacity-slider');

    // FIXED: Initialize friction slider with JSON value
    if (frictionSlider) {
        // Set slider to match JSON config when simulator is ready
        if (simulator && simulator.config) {
            frictionSlider.value = simulator.config.friction;
            document.getElementById('friction-value').textContent = simulator.config.friction;
        }
        
        frictionSlider.addEventListener('input', () => {
            document.getElementById('friction-value').textContent = frictionSlider.value;
            updateFriction(parseFloat(frictionSlider.value));
        });
    }


    // centralSlider.addEventListener('input', () => {
    //     document.getElementById('central-value').textContent = centralSlider.value;
    //     updateCentralForce(parseFloat(centralSlider.value));
    // });

    scaleSlider.addEventListener('input', () => {
        document.getElementById('force-scale-value').textContent = scaleSlider.value;
        updateForceScale(parseFloat(scaleSlider.value));
    });
    
    // NEW: Particle size slider
    if (sizeSlider) {
        sizeSlider.addEventListener('input', () => {
            document.getElementById('particle-size-value').textContent = sizeSlider.value;
            updateParticleSize(parseFloat(sizeSlider.value));
        });
    }
    
    // NEW: Particle opacity slider
    if (opacitySlider) {
        opacitySlider.addEventListener('input', () => {
            document.getElementById('particle-opacity-value').textContent = opacitySlider.value;
            updateParticleOpacity(parseFloat(opacitySlider.value));
        });
    }
}
// Add these functions to your main.js file:

function updateForceScale(scale) {
    if (!simulator || !simulator.config) return;
    
    // Update all force matrices with the new scale
    const { numTypes, strengthMatrix, radiusMatrix, collisionStrengthMatrix, collisionRadiusMatrix } = simulator.config;
    
    // Create scaled matrices
    const scaledStrength = strengthMatrix.map(v => v * scale);
    const scaledCollisionStrength = collisionStrengthMatrix.map(v => v * scale);
    
    // Update GPU buffers
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

function updateCentralForce(force) {
    if (!simulator || !simulator.gpu || !simulator.gpu.device) return;
    
    // Update the uniform buffer with new central force
    const uniformData = new Float32Array([
        0.02,   // radius
        0.15,   // rMax
        0.001,  // dt
        simulator.config.friction || 0.98,  // friction
        force,  // central force
        simulator.config.numTypes || 3      // numTypes
    ]);
    
    simulator.gpu.device.queue.writeBuffer(
        simulator.uniformBuffer,
        0,
        uniformData
    );
}

function updateFriction(frictionHalfLife) {
    if (!simulator || !simulator.gpu || !simulator.gpu.device) return;
    
    // Update the config to keep everything in sync
    simulator.config.friction = frictionHalfLife;
    
    // Calculate friction coefficient from half-life (same formula as simulator)
    const dt = 0.001;
    const friction = Math.exp(-Math.log(2) * dt / (frictionHalfLife * 0.001));
    
    // Update the uniform buffer with the new friction coefficient
    const uniformData = new Float32Array([
        0.02,   // radius
        0.15,   // rMax
        dt,     // dt
        friction, // friction coefficient (calculated from half-life)
        simulator.config.centralForce || 0.0, // central force
        simulator.config.numTypes || 3        // numTypes
    ]);
    
    simulator.gpu.device.queue.writeBuffer(
        simulator.uniformBuffer,
        0,
        uniformData
    );
    
    console.log(`Updated friction: half-life=${frictionHalfLife}, coefficient=${friction.toFixed(4)}`);
}


// NEW: Update particle size
function updateParticleSize(size) {
    if (simulator && simulator.updateParticleAppearance) {
        const currentOpacity = simulator.config.particleOpacity;
        simulator.updateParticleAppearance(size, currentOpacity);
    }
}

// NEW: Update particle opacity
function updateParticleOpacity(opacity) {
    if (simulator && simulator.updateParticleAppearance) {
        const currentSize = simulator.config.particleSize;
        simulator.updateParticleAppearance(currentSize, opacity);
    }
}

function syncSlidersWithConfig() {
    if (!simulator || !simulator.config) return;
    
    // Sync friction slider
    const frictionSlider = document.getElementById('friction-slider');
    if (frictionSlider) {
        frictionSlider.value = simulator.config.friction;
        document.getElementById('friction-value').textContent = simulator.config.friction;
    }
    
    // // Sync central force slider
    // const centralSlider = document.getElementById('central-slider');
    // if (centralSlider) {
    //     centralSlider.value = simulator.config.centralForce;
    //     document.getElementById('central-value').textContent = simulator.config.centralForce;
    // }
    
    // Sync particle appearance sliders
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

// // Debug: Check if particle positions are changing
// let debugCheckCount = 0;
// let lastPositions = [];

// function checkParticleMovement() {
//     if (!simulator || !simulator.gpu || debugCheckCount >= 5) return;
    
//     debugCheckCount++;
//     console.log(`Debug check #${debugCheckCount}`);
    
//     // Create a buffer to read particle data
//     const readBuffer = simulator.gpu.device.createBuffer({
//         size: 20 * 4, // First 4 particles (5 floats each)
//         usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
//     });
    
//     // Copy from the current particle buffer
//     const commandEncoder = simulator.gpu.device.createCommandEncoder();
//     commandEncoder.copyBufferToBuffer(
//         simulator.particleBuffers[simulator.bufferIndex],
//         0,
//         readBuffer,
//         0,
//         20 * 4
//     );
//     simulator.gpu.device.queue.submit([commandEncoder.finish()]);
    
//     // Read the data
//     readBuffer.mapAsync(GPUMapMode.READ).then(() => {
//         const data = new Float32Array(readBuffer.getMappedRange());
        
//         console.log("Current particle positions:");
//         for (let i = 0; i < 4; i++) {
//             const baseIdx = i * 5;
//             const currentPos = {
//                 x: data[baseIdx].toFixed(4),
//                 y: data[baseIdx + 1].toFixed(4),
//                 vx: data[baseIdx + 2].toFixed(4),
//                 vy: data[baseIdx + 3].toFixed(4),
//                 type: data[baseIdx + 4]
//             };
//             console.log(`Particle ${i}:`, currentPos);
            
//             // Compare with last check
//             if (lastPositions[i]) {
//                 const deltaX = Math.abs(currentPos.x - lastPositions[i].x);
//                 const deltaY = Math.abs(currentPos.y - lastPositions[i].y);
//                 console.log(`  Movement: dx=${deltaX.toFixed(6)}, dy=${deltaY.toFixed(6)}`);
                
//                 if (deltaX > 0.001 || deltaY > 0.001) {
//                     console.log("  ✓ Particle is moving!");
//                 } else {
//                     console.log("  ✗ Particle is NOT moving");
//                 }
//             }
//         }
        
//         // Store current positions
//         lastPositions = [];
//         for (let i = 0; i < 4; i++) {
//             const baseIdx = i * 5;
//             lastPositions[i] = {
//                 x: data[baseIdx],
//                 y: data[baseIdx + 1]
//             };
//         }
        
//         readBuffer.unmap();
//         readBuffer.destroy();
//     });
// }

// // Check particle movement every 2 seconds
// setTimeout(() => {
//     checkParticleMovement();
//     setInterval(checkParticleMovement, 2000);
// }, 2000);