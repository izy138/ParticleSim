let simulator;

async function startSimulation() {
    try {
        // Create simulator with default configuration
        simulator = new ParticleLifeSimulator('webgpu-canvas', {});
        
        // Initialize the simulator
        const initialized = await simulator.initialize();
        
        if (initialized) {
            console.log("Simulator initialized successfully");
            
            // FIXED: Only set up debug monitoring AFTER successful initialization
            setupDebugMonitoring();
            
            // Start the simulation
            simulator.start();
        } else {
            console.error("Failed to initialize the particle simulator.");
        }
    } catch (error) {
        console.error("Error starting simulation:", error);
        WebGPUUtils.showError(`Error starting simulation: ${error.message}`);
    }
}

// FIXED: Set up debug monitoring in a separate function
function setupDebugMonitoring() {
    if (!simulator || !simulator.render) {
        console.warn("Cannot set up debug monitoring - simulator not ready");
        return;
    }
    
    // Add debug monitoring to see if compute shader is working
    let frameCount = 0;
    const originalRender = simulator.render.bind(simulator); // FIXED: Properly bind the context
    
    simulator.render = function() {
        frameCount++;
        if (frameCount % 60 === 0) {
            console.log(`Frame ${frameCount} - Buffer index: ${this.bufferIndex}`);
        }
        originalRender();
    };
}

// Configure the canvas size based on simulation size
function configureCanvas() {
    const canvas = document.getElementById('webgpu-canvas');
    if (canvas) {
        // Set default size
        canvas.width = 800;
        canvas.height = 600;
        
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
        }
    });
    document.getElementById('reset-btn').addEventListener('click', () => {
        if (simulator) {
            simulator.reset();
        }
    });
    
    // Start simulation immediately
    startSimulation();
});

function setupSliders() {
    const frictionSlider = document.getElementById('friction-slider');
    const centralSlider = document.getElementById('central-slider');
    const scaleSlider = document.getElementById('force-scale-slider');

    frictionSlider.addEventListener('input', () => {
        document.getElementById('friction-value').textContent = frictionSlider.value;
        updateFriction(parseFloat(frictionSlider.value));
    });

    centralSlider.addEventListener('input', () => {
        document.getElementById('central-value').textContent = centralSlider.value;
        updateCentralForce(parseFloat(centralSlider.value));
    });

    scaleSlider.addEventListener('input', () => {
        document.getElementById('force-scale-value').textContent = scaleSlider.value;
        updateForceScale(parseFloat(scaleSlider.value));
    });
}


// Debug: Check if particle positions are changing
let debugCheckCount = 0;
let lastPositions = [];

function checkParticleMovement() {
    if (!simulator || !simulator.gpu || debugCheckCount >= 5) return;
    
    debugCheckCount++;
    console.log(`Debug check #${debugCheckCount}`);
    
    // Create a buffer to read particle data
    const readBuffer = simulator.gpu.device.createBuffer({
        size: 20 * 4, // First 4 particles (5 floats each)
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });
    
    // Copy from the current particle buffer
    const commandEncoder = simulator.gpu.device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(
        simulator.particleBuffers[simulator.bufferIndex],
        0,
        readBuffer,
        0,
        20 * 4
    );
    simulator.gpu.device.queue.submit([commandEncoder.finish()]);
    
    // Read the data
    readBuffer.mapAsync(GPUMapMode.READ).then(() => {
        const data = new Float32Array(readBuffer.getMappedRange());
        
        console.log("Current particle positions:");
        for (let i = 0; i < 4; i++) {
            const baseIdx = i * 5;
            const currentPos = {
                x: data[baseIdx].toFixed(4),
                y: data[baseIdx + 1].toFixed(4),
                vx: data[baseIdx + 2].toFixed(4),
                vy: data[baseIdx + 3].toFixed(4),
                type: data[baseIdx + 4]
            };
            console.log(`Particle ${i}:`, currentPos);
            
            // Compare with last check
            if (lastPositions[i]) {
                const deltaX = Math.abs(currentPos.x - lastPositions[i].x);
                const deltaY = Math.abs(currentPos.y - lastPositions[i].y);
                console.log(`  Movement: dx=${deltaX.toFixed(6)}, dy=${deltaY.toFixed(6)}`);
                
                if (deltaX > 0.001 || deltaY > 0.001) {
                    console.log("  ✓ Particle is moving!");
                } else {
                    console.log("  ✗ Particle is NOT moving");
                }
            }
        }
        
        // Store current positions
        lastPositions = [];
        for (let i = 0; i < 4; i++) {
            const baseIdx = i * 5;
            lastPositions[i] = {
                x: data[baseIdx],
                y: data[baseIdx + 1]
            };
        }
        
        readBuffer.unmap();
        readBuffer.destroy();
    });
}

// Check particle movement every 2 seconds
setTimeout(() => {
    checkParticleMovement();
    setInterval(checkParticleMovement, 2000);
}, 2000);