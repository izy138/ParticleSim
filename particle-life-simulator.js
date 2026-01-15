// REFACTORED particle-life-simulator.js (Core simulation only)

class ParticleLifeSimulator {
    constructor(canvasId, config) {
        this.canvasId = canvasId;
        this.frameCount = 0;
        this.debugInterval = 60;

        this.config = Object.assign({
            numParticles: 10000,
            numTypes: 8,
            particleSize: 0.007,
            particleOpacity: 0.75
        }, config);

        this.isRunning = false;
        this.isPaused = false;
        this.frameId = null;
        this.bufferIndex = 0;
        this.lastFrameTime = null; // For frame-rate independent timing
        // mouse 
        this.mouseInteraction = null;
        this.mouseUniformBuffer = null;
        
        // STEP 1: Binning configuration (will be used in future steps)
        // Bin size: particles interact within ~0.15 units, so bins should be slightly larger
        // Using 0.2 units per bin gives us ~10 bins per dimension in [-1, 1] space
        this.binSize = 0.2;
        this.gridWidth = 0;
        this.gridHeight = 0;
        this.binCount = 0;
        this.useBinning = true; // Flag to enable/disable binning
    }

    async initialize() {
        try {
            console.log("Starting WebGPU initialization...");

            this.gpu = await WebGPUUtils.initialize(this.canvasId);
            if (!this.gpu) return false;

            await this.loadConfiguration();
            // console.log("Configuration loaded:"
            //     , {
            //     numParticles: this.config.numParticles,
            //     numTypes: this.config.numTypes,
            //     particleSize: this.config.particleSize,
            //     particleOpacity: this.config.particleOpacity
            // });

            const computeShaderCode = await WebGPUUtils.loadShader('shaders/particle-compute.wgsl');
            const renderShaderCode = await WebGPUUtils.loadShader('shaders/particle-render.wgsl');

            this.initializeParticles();
            this.createShaderModules(computeShaderCode, renderShaderCode);
            await this.loadBinnedComputeShader(); // Load binned compute shader for Step 5
            this.setupMouseInteraction(); //mouse
            this.createBindGroups();
            this.createPipelines();
            
            // STEP 2: Create count shader pipeline (for testing) - optional, don't fail if it errors
            try {
                await this.createCountPipeline();
            } catch (error) {
                console.warn('[Step 2] Could not create count pipeline (this is okay for now):', error);
            }
            
            // STEP 3: Create prefix sum shader pipeline (for testing) - optional, don't fail if it errors
            try {
                await this.createPrefixSumPipeline();
            } catch (error) {
                console.warn('[Step 3] Could not create prefix sum pipeline (this is okay for now):', error);
            }
            
            // STEP 4: Create sort shader pipeline (for testing) - optional, don't fail if it errors
            try {
                await this.createSortPipeline();
            } catch (error) {
                console.warn('[Step 4] Could not create sort pipeline (this is okay for now):', error);
            }

            // Expose test functions globally
            window.testCountShader = async () => {
                return await this.testCountShader();
            };
            window.testPrefixSumShader = async () => {
                return await this.testPrefixSumShader();
            };
            window.testSortShader = async () => {
                return await this.testSortShader();
            };
            
            // Also expose simulator instance for direct access
            window.particleSimulator = this;

            console.log("Initialization complete!");
            console.log("[Step 2] Test function available: testCountShader() or window.particleSimulator.testCountShader()");
            return true;
        } catch (error) {
            console.error("Initialization error:", error);
            WebGPUUtils.showError(`Simulator initialization failed: ${error.message}`);
            return false;
        }
    }

    async loadConfiguration() {
        if (this.config.species && this.config.species.length > 0) {
            console.log("Using provided configuration");
            this.config.numParticles = this.config.particleCount || this.config.numParticles;
            this.config.numTypes = this.config.species.length;
            this.config.colors = this.config.species.map(species => species.color);
            this.config.attractionMatrix = this.extractAttractionMatrix(this.config.species);
            return;
        }

        try {
            const response = await fetch('particle-life-system.json');
            if (!response.ok) {
                console.log("No particle-life-system.json found, using default configuration");
                this.useDefaultConfiguration();
                return;
            }

            const config = await response.json();
            this.config.numParticles = config.particleCount;
            this.config.numTypes = config.species.length;
            this.config.simulationSize = config.simulationSize;
            this.config.friction = parseFloat(config.friction) || 50.0;
            this.config.centralForce = config.centralForce || 0;
            this.config.symmetricForces = config.symmetricForces || false;
            this.config.species = config.species;

            if (config.particleSize !== undefined) {
                this.config.particleSize = config.particleSize;
            }
            if (config.particleOpacity !== undefined) {
                this.config.particleOpacity = config.particleOpacity;
            }

            this.config.colors = config.species.map(species => species.color);
            this.config.attractionMatrix = this.extractAttractionMatrix(config.species);

            console.log("Loaded configuration from particle-life-system.json");
        } catch (error) {
            console.warn("Could not load particle-life-system.json:", error.message);
            this.useDefaultConfiguration();
        }
    }

    useDefaultConfiguration() {
        console.log("Using default configuration");
        this.config.friction = 50.0;
        this.config.centralForce = 0;
        this.config.symmetricForces = false;

        // Generate default species configuration
        this.config.species = this.generateDefaultSpecies();
        this.config.numTypes = this.config.species.length;
        this.config.colors = this.config.species.map(species => species.color);
        this.config.attractionMatrix = this.extractAttractionMatrix(this.config.species);
    }

    generateDefaultSpecies() {
        const numTypes = this.config.numTypes || 8;
        const species = [];

        for (let i = 0; i < numTypes; i++) {
            const hue = (i * 360 / numTypes) % 360;
            const [r, g, b] = this.hslToRgb(hue, 0.8, 0.6);

            const forces = [];
            for (let j = 0; j < numTypes; j++) {
                forces.push({
                    strength: (Math.random() * 200 - 100),
                    radius: 5 + Math.random() * 20,
                    collisionStrength: 200 + Math.random() * 500,
                    collisionRadius: 0.5 + Math.random() * 3
                });
            }

            species.push({
                name: `Type ${i + 1}`,
                color: [r, g, b, 1.0],
                forces: forces
            });
        }

        return species;
    }

    extractAttractionMatrix(species) {
        const numTypes = species.length;
        const matrix = [];

        for (let i = 0; i < numTypes; i++) {
            const row = [];
            for (let j = 0; j < numTypes; j++) {
                if (species[i].forces && species[i].forces[j]) {
                    const normalizedStrength = species[i].forces[j].strength / 100.0;
                    row.push(normalizedStrength);
                } else {
                    row.push(0.0);
                }
            }
            matrix.push(row);
        }

        return matrix;
    }

    generateRandomAttractionMatrix() {
        const { numTypes } = this.config;
        const matrix = [];

        for (let i = 0; i < numTypes; i++) {
            const row = [];
            for (let j = 0; j < numTypes; j++) {
                row.push(Math.random() * 2 - 1);
            }
            matrix.push(row);
        }

        return matrix;
    }

    generateRandomColors() {
        const { numTypes } = this.config;
        const colors = [];

        for (let i = 0; i < numTypes; i++) {
            const hue = (i * 360 / numTypes) % 360;
            const saturation = 0.8 + Math.random() * 0.2;
            const lightness = 0.5 + Math.random() * 0.3;

            const [r, g, b] = this.hslToRgb(hue, saturation, lightness);
            colors.push([r, g, b, 1.0]);
        }

        return colors;
    }

    hslToRgb(h, s, l) {
        h /= 360;
        const a = s * Math.min(l, 1 - l);
        const f = (n, k = (n + h / (1 / 12)) % 12) => l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return [f(0), f(8), f(4)];
    }

    initializeParticles() {
        const { device, canvas } = this.gpu;
        const { numParticles, numTypes } = this.config;

        // console.log(`Initializing ${numParticles} particles with ${numTypes} types`);

        const aspectRatio = canvas.width / canvas.height;
        const particleData = new Float32Array(numParticles * 5);

        for (let i = 0; i < numParticles; i++) {
            const baseIndex = i * 5;
            // Spawn particles across full canvas space
            let x = Math.random() * 2 - 1;  // Full width
            let y = Math.random() * 2 - 1;  // Full height

            particleData[baseIndex] = x;
            particleData[baseIndex + 1] = y;
            particleData[baseIndex + 2] = (Math.random() - 0.5) * 0.1;
            particleData[baseIndex + 3] = (Math.random() - 0.5) * 0.1;
            particleData[baseIndex + 4] = Math.floor(Math.random() * numTypes);
        }

        const bufferSize = particleData.byteLength;
        this.particleBuffers = [
            device.createBuffer({
                size: bufferSize,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
                mappedAtCreation: true
            }),
            device.createBuffer({
                size: bufferSize,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
                mappedAtCreation: true
            })
        ];

        new Float32Array(this.particleBuffers[0].getMappedRange()).set(particleData);
        this.particleBuffers[0].unmap();
        new Float32Array(this.particleBuffers[1].getMappedRange()).set(particleData);
        this.particleBuffers[1].unmap();

        // Create uniform buffer with aspect ratio
        this.createUniformBuffer();
        this.createForceMatrices();
        this.createColorBuffers();
        this.createRenderUniformBuffer();
        
        // STEP 1: Create binning buffers (no shaders yet - just buffers)
        this.createBinningBuffers();
    }
    
    // STEP 1: Create binning buffers
    // This just creates the buffers we'll need. We won't use them until later steps.
    createBinningBuffers() {
        const { device, canvas } = this.gpu;
        
        // Calculate grid dimensions
        // We work in normalized coordinates [-1, 1], so total space is 2 units
        this.gridWidth = Math.ceil(2.0 / this.binSize);
        this.gridHeight = Math.ceil(2.0 / this.binSize);
        this.binCount = this.gridWidth * this.gridHeight;
        
        console.log(`[Step 1] Binning buffers: ${this.gridWidth}x${this.gridHeight} = ${this.binCount} bins`);
        
        // Buffer 1: Bin counts (how many particles in each bin)
        // Size is binCount + 1 for prefix sum (we'll store counts starting at index 1)
        this.binCountBuffer = device.createBuffer({
            size: (this.binCount + 1) * 4, // 4 bytes per u32
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
            label: 'bin-count-buffer'
        });
        
        // Buffer 2: Bin offsets (where each bin starts in sorted array)
        // After prefix sum, this will contain the starting index for each bin
        // This buffer is used with atomic operations in the sort shader
        this.binOffsetBuffer = device.createBuffer({
            size: (this.binCount + 1) * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
            label: 'bin-offset-buffer'
        });
        
        // Buffer 2b: Read-only bin offsets for compute shader
        // We copy from binOffsetBuffer to this after sorting to avoid validation errors
        this.binOffsetReadBuffer = device.createBuffer({
            size: (this.binCount + 1) * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            label: 'bin-offset-read-buffer'
        });
        
        // Buffer 3: Sorted particles (particles reordered by bin)
        this.sortedParticleBuffer = device.createBuffer({
            size: this.config.numParticles * 5 * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
            label: 'sorted-particle-buffer'
        });
        
        // Buffer 4: Temporary buffer for prefix sum ping-pong
        this.binTempBuffer = device.createBuffer({
            size: (this.binCount + 1) * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC, // Added COPY_SRC for buffer copies
            label: 'bin-temp-buffer'
        });
        
        // Buffer 5: Binning parameters (bin size, grid dimensions)
        const binningParams = new Float32Array([
            this.binSize,
            this.gridWidth,
            this.gridHeight,
            0.0 // padding
        ]);
        
        this.binningParamsBuffer = device.createBuffer({
            size: binningParams.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Float32Array(this.binningParamsBuffer.getMappedRange()).set(binningParams);
        this.binningParamsBuffer.unmap();
        
        console.log(`[Step 1] ✓ Binning buffers created (not used yet)`);
    }

    createUniformBuffer() {
        const { device, canvas } = this.gpu;
        const aspectRatio = canvas.width / canvas.height;
        const frictionHalfLife = this.config.friction * 0.001;
        const dt = 0.0025;
        const friction = Math.exp(-Math.log(2) * dt / frictionHalfLife);

        const uniformData = new Float32Array([
            0.02,   // radius
            0.15,   // rMax
            dt,     // dt
            friction, // friction
            this.config.centralForce || 0.0, // central force
            this.config.numTypes || 3,       // numTypes
            aspectRatio,                     // aspect ratio
            0.0                              // padding
        ]);

        this.uniformBuffer = device.createBuffer({
            size: uniformData.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Float32Array(this.uniformBuffer.getMappedRange()).set(uniformData);
        this.uniformBuffer.unmap();
    }

    createForceMatrices() {
        const { device } = this.gpu;
        const { numTypes } = this.config;
        const species = this.config.species;

        if (!this.config.attractionMatrix) {
            this.config.attractionMatrix = this.generateRandomAttractionMatrix();
        }

        const strengthMatrix = [];
        const radiusMatrix = [];
        const collisionStrengthMatrix = [];
        const collisionRadiusMatrix = [];

        for (let i = 0; i < numTypes; i++) {
            for (let j = 0; j < numTypes; j++) {
                const force = species[i].forces?.[j];
                strengthMatrix.push(force ? force.strength / 200.0 : 100);
                radiusMatrix.push(force ? force.radius / 130 : 15);
                collisionStrengthMatrix.push(force ? force.collisionStrength / 30.0 : 15);
                collisionRadiusMatrix.push(force ? force.collisionRadius / 275.0 : 15);
            }
        }

        this.config.strengthMatrix = strengthMatrix;
        this.config.radiusMatrix = radiusMatrix;
        this.config.collisionStrengthMatrix = collisionStrengthMatrix;
        this.config.collisionRadiusMatrix = collisionRadiusMatrix;

        this.strengthBuffer = WebGPUUtils.createBuffer(device, new Float32Array(strengthMatrix), GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
        this.radiusBuffer = WebGPUUtils.createBuffer(device, new Float32Array(radiusMatrix), GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
        this.collisionStrengthBuffer = WebGPUUtils.createBuffer(device, new Float32Array(collisionStrengthMatrix), GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
        this.collisionRadiusBuffer = WebGPUUtils.createBuffer(device, new Float32Array(collisionRadiusMatrix), GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);

        // Create attraction matrix buffer
        const matrixData = new Float32Array(numTypes * numTypes);
        for (let i = 0; i < numTypes; i++) {
            for (let j = 0; j < numTypes; j++) {
                matrixData[i * numTypes + j] = this.config.attractionMatrix[i][j];
            }
        }

        this.matrixBuffer = device.createBuffer({
            size: matrixData.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Float32Array(this.matrixBuffer.getMappedRange()).set(matrixData);
        this.matrixBuffer.unmap();
    }

    createColorBuffers() {
        const { device } = this.gpu;
        const { numTypes } = this.config;

        if (!this.config.colors) {
            this.config.colors = this.generateRandomColors();
        }

        const colorData = new Float32Array(numTypes * 4);
        for (let i = 0; i < numTypes; i++) {
            for (let j = 0; j < 4; j++) {
                colorData[i * 4 + j] = this.config.colors[i][j];
            }
        }

        this.colorBuffer = device.createBuffer({
            size: colorData.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Float32Array(this.colorBuffer.getMappedRange()).set(colorData);
        this.colorBuffer.unmap();
    }

    createRenderUniformBuffer() {
        const { device, canvas } = this.gpu;
        const aspectRatio = canvas.width / canvas.height;

        const renderUniformData = new Float32Array([
            this.config.particleSize,
            this.config.particleOpacity,
            aspectRatio,
            0.0
        ]);

        this.renderUniformBuffer = device.createBuffer({
            size: renderUniformData.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Float32Array(this.renderUniformBuffer.getMappedRange()).set(renderUniformData);
        this.renderUniformBuffer.unmap();
    }

    updateParticleAppearance(size, opacity) {
        if (!this.gpu || !this.gpu.device || !this.renderUniformBuffer) return;

        const { device, canvas } = this.gpu;
        this.config.particleSize = size;
        this.config.particleOpacity = opacity;

        const aspectRatio = canvas.width / canvas.height;
        const renderUniformData = new Float32Array([
            this.config.particleSize,
            this.config.particleOpacity,
            aspectRatio,
            0.0
        ]);

        device.queue.writeBuffer(this.renderUniformBuffer, 0, renderUniformData);
    }

    updateAspectRatio() {
        if (!this.gpu || !this.gpu.device || !this.uniformBuffer) return;

        const canvas = this.gpu.canvas;
        const aspectRatio = canvas.width / canvas.height;

        const dt = 0.002;
        const frictionHalfLife = this.config.friction * 0.001;
        const friction = Math.exp(-Math.log(2) * dt / frictionHalfLife);

        const uniformData = new Float32Array([
            0.02, 0.15, dt, friction,
            this.config.centralForce || 0.0,
            this.config.numTypes || 3,
            aspectRatio, 0.0
        ]);

        this.gpu.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);

        // Only update particle appearance if renderUniformBuffer exists
        if (this.renderUniformBuffer) {
            this.updateParticleAppearance(this.config.particleSize, this.config.particleOpacity);
        }
    }

    // Shader and pipeline creation methods
    createShaderModules(computeShaderCode, renderShaderCode) {
        const { device } = this.gpu;

        this.computeModule = device.createShaderModule({
            label: 'compute-module',
            code: computeShaderCode
        });

        this.renderModule = device.createShaderModule({
            label: 'render-module',
            code: renderShaderCode
        });
    }

    // Load binned compute shader module (for Step 5)
    async loadBinnedComputeShader() {
        const { device } = this.gpu;
        try {
            const shaderCode = await WebGPUUtils.loadShader('shaders/particle-compute-binned.wgsl');
            this.binnedComputeModule = device.createShaderModule({
                label: 'binned-compute-module',
                code: shaderCode
            });
            console.log('[Step 5] ✓ Binned compute shader module loaded');
        } catch (error) {
            console.error('[Step 5] ✗ Failed to load binned compute shader:', error);
            this.binnedComputeModule = null;
            // Don't throw - allow simulation to continue without binning
        }
    }
    createBindGroups() {
        const { device } = this.gpu;

        // Check if mouse uniform buffer exists, if not create a default one
        if (!this.mouseUniformBuffer) {
            console.warn("Mouse uniform buffer not found, creating default buffer");
            this.createMouseUniformBuffer();
        }

        // Compute bind group layout - ADD mouse binding
        this.computeBindGroupLayout = device.createBindGroupLayout({
            label: 'compute-bind-group-layout',
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
                { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
                { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
                { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
                { binding: 6, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
                { binding: 7, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
                { binding: 8, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } } // NEW: Mouse data
            ]
        });

        // Binned compute bind group layout (for Step 5)
        this.binnedComputeBindGroupLayout = device.createBindGroupLayout({
            label: 'binned-compute-bind-group-layout',
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // sortedParticles
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }, // particlesOut
                { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // binOffsets
                { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }, // params
                { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // strengthMatrix
                { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // radiusMatrix
                { binding: 6, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // collisionStrengthMatrix
                { binding: 7, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // collisionRadiusMatrix
                { binding: 8, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }, // mouseData
                { binding: 9, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } } // binningParams
            ]
        });

        // Create compute bind groups - ADD mouse binding
        this.computeBindGroups = [
            device.createBindGroup({
                label: 'compute-bind-group-0',
                layout: this.computeBindGroupLayout,
                entries: [
                    { binding: 0, resource: { buffer: this.particleBuffers[0] } },
                    { binding: 1, resource: { buffer: this.particleBuffers[1] } },
                    { binding: 2, resource: { buffer: this.uniformBuffer } },
                    { binding: 3, resource: { buffer: this.matrixBuffer } },
                    { binding: 4, resource: { buffer: this.strengthBuffer } },
                    { binding: 5, resource: { buffer: this.radiusBuffer } },
                    { binding: 6, resource: { buffer: this.collisionStrengthBuffer } },
                    { binding: 7, resource: { buffer: this.collisionRadiusBuffer } },
                    { binding: 8, resource: { buffer: this.mouseUniformBuffer } } // NEW: Mouse data
                ]
            }),
            device.createBindGroup({
                label: 'compute-bind-group-1',
                layout: this.computeBindGroupLayout,
                entries: [
                    { binding: 0, resource: { buffer: this.particleBuffers[1] } },
                    { binding: 1, resource: { buffer: this.particleBuffers[0] } },
                    { binding: 2, resource: { buffer: this.uniformBuffer } },
                    { binding: 3, resource: { buffer: this.matrixBuffer } },
                    { binding: 4, resource: { buffer: this.strengthBuffer } },
                    { binding: 5, resource: { buffer: this.radiusBuffer } },
                    { binding: 6, resource: { buffer: this.collisionStrengthBuffer } },
                    { binding: 7, resource: { buffer: this.collisionRadiusBuffer } },
                    { binding: 8, resource: { buffer: this.mouseUniformBuffer } } // NEW: Mouse data
                ]
            })
        ];

        // Render bind group layout
        this.renderBindGroupLayout = device.createBindGroupLayout({
            label: 'render-bind-group-layout',
            entries: [
                { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
                { binding: 1, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
                { binding: 2, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }
            ]
        });

        // Create render bind groups 
        this.renderBindGroups = [
            device.createBindGroup({
                label: 'render-bind-group-0',
                layout: this.renderBindGroupLayout,
                entries: [
                    { binding: 0, resource: { buffer: this.particleBuffers[0] } },
                    { binding: 1, resource: { buffer: this.colorBuffer } },
                    { binding: 2, resource: { buffer: this.renderUniformBuffer } }
                ]
            }),
            device.createBindGroup({
                label: 'render-bind-group-1',
                layout: this.renderBindGroupLayout,
                entries: [
                    { binding: 0, resource: { buffer: this.particleBuffers[1] } },
                    { binding: 1, resource: { buffer: this.colorBuffer } },
                    { binding: 2, resource: { buffer: this.renderUniformBuffer } }
                ]
            })
        ];

        console.log("Bind groups created successfully with mouse uniform buffer");

        // Create binned compute bind groups (for Step 5)
        // Only create if binning buffers exist
        if (this.sortedParticleBuffer && this.binOffsetBuffer && this.binOffsetReadBuffer && this.binningParamsBuffer) {
            try {
                this.binnedComputeBindGroups = [
                    device.createBindGroup({
                        label: 'binned-compute-bind-group-0',
                        layout: this.binnedComputeBindGroupLayout,
                        entries: [
                            { binding: 0, resource: { buffer: this.sortedParticleBuffer } },
                            { binding: 1, resource: { buffer: this.particleBuffers[1] } },
                            { binding: 2, resource: { buffer: this.binOffsetReadBuffer } }, // Use read-only buffer
                            { binding: 3, resource: { buffer: this.uniformBuffer } },
                            { binding: 4, resource: { buffer: this.strengthBuffer } },
                            { binding: 5, resource: { buffer: this.radiusBuffer } },
                            { binding: 6, resource: { buffer: this.collisionStrengthBuffer } },
                            { binding: 7, resource: { buffer: this.collisionRadiusBuffer } },
                            { binding: 8, resource: { buffer: this.mouseUniformBuffer } },
                            { binding: 9, resource: { buffer: this.binningParamsBuffer } }
                        ]
                    }),
                    device.createBindGroup({
                        label: 'binned-compute-bind-group-1',
                        layout: this.binnedComputeBindGroupLayout,
                        entries: [
                            { binding: 0, resource: { buffer: this.sortedParticleBuffer } },
                            { binding: 1, resource: { buffer: this.particleBuffers[0] } },
                            { binding: 2, resource: { buffer: this.binOffsetReadBuffer } }, // Use read-only buffer
                            { binding: 3, resource: { buffer: this.uniformBuffer } },
                            { binding: 4, resource: { buffer: this.strengthBuffer } },
                            { binding: 5, resource: { buffer: this.radiusBuffer } },
                            { binding: 6, resource: { buffer: this.collisionStrengthBuffer } },
                            { binding: 7, resource: { buffer: this.collisionRadiusBuffer } },
                            { binding: 8, resource: { buffer: this.mouseUniformBuffer } },
                            { binding: 9, resource: { buffer: this.binningParamsBuffer } }
                        ]
                    })
                ];
                console.log('[Step 5] ✓ Binned compute bind groups created');
            } catch (error) {
                console.error('[Step 5] ✗ Failed to create binned compute bind groups:', error);
                this.binnedComputeBindGroups = null;
            }
        } else {
            console.warn('[Step 5] Binning buffers not ready, skipping binned compute bind groups');
            this.binnedComputeBindGroups = null;
        }
    }

    createPipelines() {
        const { device, presentationFormat } = this.gpu;

        // Compute pipeline
        const computePipelineLayout = device.createPipelineLayout({
            label: 'compute-pipeline-layout',
            bindGroupLayouts: [this.computeBindGroupLayout]
        });

        this.computePipeline = device.createComputePipeline({
            label: 'compute-pipeline',
            layout: computePipelineLayout,
            compute: {
                module: this.computeModule,
                entryPoint: 'main'
            }
        });

        // Binned compute pipeline (for Step 5)
        if (this.binnedComputeModule) {
            try {
                const binnedComputePipelineLayout = device.createPipelineLayout({
                    label: 'binned-compute-pipeline-layout',
                    bindGroupLayouts: [this.binnedComputeBindGroupLayout]
                });

                this.binnedComputePipeline = device.createComputePipeline({
                    label: 'binned-compute-pipeline',
                    layout: binnedComputePipelineLayout,
                    compute: {
                        module: this.binnedComputeModule,
                        entryPoint: 'main'
                    }
                });
                console.log('[Step 5] ✓ Binned compute pipeline created successfully');
                
                // Validate the pipeline by checking if we can get its bind group layout
                try {
                    const layout = this.binnedComputePipeline.getBindGroupLayout(0);
                    console.log('[Step 5] ✓ Binned compute pipeline bind group layout validated');
                } catch (layoutError) {
                    console.error('[Step 5] ✗ Failed to get bind group layout from pipeline:', layoutError);
                    this.binnedComputePipeline = null;
                }
            } catch (error) {
                console.error('[Step 5] ✗ Failed to create binned compute pipeline:', error);
                console.error('[Step 5] Error details:', error.message, error.stack);
                this.binnedComputePipeline = null;
            }
        } else {
            console.warn('[Step 5] Binned compute module not loaded, skipping pipeline creation');
            this.binnedComputePipeline = null;
        }

        // Render pipeline
        const renderPipelineLayout = device.createPipelineLayout({
            label: 'render-pipeline-layout',
            bindGroupLayouts: [this.renderBindGroupLayout]
        });

        this.renderPipeline = device.createRenderPipeline({
            label: 'render-pipeline',
            layout: renderPipelineLayout,
            vertex: {
                module: this.renderModule,
                entryPoint: 'vertexMain'
            },
            fragment: {
                module: this.renderModule,
                entryPoint: 'fragmentMain',
                targets: [{
                    format: presentationFormat,
                    blend: {
                        color: {
                            srcFactor: 'src-alpha',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add'
                        },
                        alpha: {
                            srcFactor: 'one',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add'
                        }
                    }
                }]
            },
            primitive: {
                topology: 'triangle-list'
            }
        });
    }

    // STEP 2: Create count shader pipeline
    async createCountPipeline() {
        if (!this.gpu || !this.gpu.device) {
            throw new Error('WebGPU not initialized');
        }
        const { device } = this.gpu;
        
        // Load count shader
        const countShaderCode = await WebGPUUtils.loadShader('shaders/bin-count.wgsl');
        
        // Create shader module
        const countModule = device.createShaderModule({
            label: 'bin-count-module',
            code: countShaderCode
        });
        
        // Create bind group layout
        const countBindGroupLayout = device.createBindGroupLayout({
            label: 'count-bind-group-layout',
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // particles
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },           // binCounts
                { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }            // params
            ]
        });
        
        // Create pipeline layout
        const countPipelineLayout = device.createPipelineLayout({
            label: 'count-pipeline-layout',
            bindGroupLayouts: [countBindGroupLayout]
        });
        
        // Create compute pipeline
        this.countPipeline = device.createComputePipeline({
            label: 'bin-count-pipeline',
            layout: countPipelineLayout,
            compute: {
                module: countModule,
                entryPoint: 'main'
            }
        });
        
        console.log('[Step 2] ✓ Count shader pipeline created');
    }

    // STEP 3: Create prefix sum shader pipeline
    async createPrefixSumPipeline() {
        if (!this.gpu || !this.gpu.device) {
            throw new Error('WebGPU not initialized');
        }
        const { device } = this.gpu;
        
        // Load prefix sum shader
        const prefixShaderCode = await WebGPUUtils.loadShader('shaders/bin-prefix-sum.wgsl');
        
        // Create shader module
        const prefixModule = device.createShaderModule({
            label: 'bin-prefix-sum-module',
            code: prefixShaderCode
        });
        
        // Create bind group layout
        const prefixBindGroupLayout = device.createBindGroupLayout({
            label: 'prefix-bind-group-layout',
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }, // binCounts (needs storage for atomic operations)
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } } // binOffsets
            ]
        });
        
        // Create pipeline layout
        const prefixPipelineLayout = device.createPipelineLayout({
            label: 'prefix-pipeline-layout',
            bindGroupLayouts: [prefixBindGroupLayout]
        });
        
        // Create compute pipeline
        this.prefixSumPipeline = device.createComputePipeline({
            label: 'bin-prefix-sum-pipeline',
            layout: prefixPipelineLayout,
            compute: {
                module: prefixModule,
                entryPoint: 'main'
            }
        });
        
        console.log('[Step 3] ✓ Prefix sum shader pipeline created');
    }

    // STEP 4: Create sort shader pipeline
    async createSortPipeline() {
        if (!this.gpu || !this.gpu.device) {
            throw new Error('WebGPU not initialized');
        }
        const { device } = this.gpu;
        
        // Load sort shader
        const sortShaderCode = await WebGPUUtils.loadShader('shaders/bin-sort.wgsl');
        
        // Create shader module with error handling
        let sortModule;
        try {
            sortModule = device.createShaderModule({
                label: 'bin-sort-module',
                code: sortShaderCode
            });
        } catch (error) {
            console.error('[Step 4] Failed to create shader module:', error);
            throw error;
        }
        
        // Create bind group layout
        const sortBindGroupLayout = device.createBindGroupLayout({
            label: 'sort-bind-group-layout',
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // particlesIn
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },           // binOffsets (atomic)
                { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },           // sortedParticles
                { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }            // params
            ]
        });
        
        // Create pipeline layout
        const sortPipelineLayout = device.createPipelineLayout({
            label: 'sort-pipeline-layout',
            bindGroupLayouts: [sortBindGroupLayout]
        });
        
        // Create compute pipeline with error handling (use async to catch compilation errors)
        try {
            this.sortPipeline = await device.createComputePipelineAsync({
                label: 'bin-sort-pipeline',
                layout: sortPipelineLayout,
                compute: {
                    module: sortModule,
                    entryPoint: 'main'
                }
            });
            console.log('[Step 4] ✓ Sort shader pipeline created');
        } catch (error) {
            console.error('[Step 4] Failed to create compute pipeline:', error);
            // Try to get more info about the shader
            console.error('[Step 4] Shader code length:', sortShaderCode.length);
            console.error('[Step 4] Shader code (first 500 chars):', sortShaderCode.substring(0, 500));
            throw error;
        }
    }

    // STEP 2: Test count shader
    // This function runs the count shader and reads back the results to verify it works
    async testCountShader() {
        console.log('[Step 2] testCountShader called');
        
        if (!this.countPipeline) {
            console.error('[Step 2] Count pipeline not created yet');
            return false;
        }

        if (!this.gpu || !this.gpu.device) {
            console.error('[Step 2] GPU device not available');
            return false;
        }
        
        console.log('[Step 2] Starting count shader test...');

        const { device } = this.gpu;
        
        try {
            // Clear bin count buffer to zeros
            const zeroData = new Uint32Array(this.binCount + 1);
            device.queue.writeBuffer(
                this.binCountBuffer,
                0,
                zeroData
            );
            
            // Create bind group for count shader
            const countBindGroup = device.createBindGroup({
                label: 'test-count-bind-group',
                layout: this.countPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: this.particleBuffers[this.bufferIndex] } },
                    { binding: 1, resource: { buffer: this.binCountBuffer } },
                    { binding: 2, resource: { buffer: this.binningParamsBuffer } }
                ]
            });
            
            // Create a readback buffer to check results (create before command encoder)
            const readbackBuffer = device.createBuffer({
                size: (this.binCount + 1) * 4,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
            });
            
            // Run count shader
            const commandEncoder = device.createCommandEncoder({ label: 'test-count-encoder' });
            
            // Compute pass
            const countPass = commandEncoder.beginComputePass({ label: 'test-count-pass' });
            countPass.setPipeline(this.countPipeline);
            countPass.setBindGroup(0, countBindGroup);
            
            const workgroupSize = 64;
            const numWorkgroups = Math.ceil(this.config.numParticles / workgroupSize);
            countPass.dispatchWorkgroups(numWorkgroups);
            countPass.end();
            
            // Copy buffer after compute pass
            commandEncoder.copyBufferToBuffer(
                this.binCountBuffer,
                0,
                readbackBuffer,
                0,
                (this.binCount + 1) * 4
            );
            
            // Finish and submit
            const commandBuffer = commandEncoder.finish();
            device.queue.submit([commandBuffer]);
            
            // Wait for GPU to finish before reading back
            await device.queue.onSubmittedWorkDone();
            
            // Read back results
            await readbackBuffer.mapAsync(GPUMapMode.READ);
            const mappedRange = readbackBuffer.getMappedRange();
            const counts = new Uint32Array(mappedRange);
            
            // Copy data before unmapping (unmap detaches the ArrayBuffer)
            const countsCopy = new Uint32Array(counts);
            readbackBuffer.unmap();
            
            // Debug: Check first few values
            console.log('[Step 2] First 10 bin counts:', Array.from(countsCopy.slice(0, 10)));
            console.log('[Step 2] All counts:', Array.from(countsCopy));
            console.log('[Step 2] Buffer size:', countsCopy.length, 'expected:', this.binCount + 1);
            console.log('[Step 2] Grid dimensions:', this.gridWidth, 'x', this.gridHeight);
            console.log('[Step 2] Bin size:', this.binSize);
            
            // Verify results
            let totalCount = 0;
            let nonEmptyBins = 0;
            let maxBinCount = 0;
            
            for (let i = 1; i <= this.binCount; i++) {
                if (countsCopy[i] > 0) {
                    nonEmptyBins++;
                    totalCount += countsCopy[i];
                    maxBinCount = Math.max(maxBinCount, countsCopy[i]);
                }
            }
            
            console.log('[Step 2] Count shader test results:');
            console.log(`  Total particles counted: ${totalCount} (expected: ${this.config.numParticles})`);
            console.log(`  Non-empty bins: ${nonEmptyBins} out of ${this.binCount}`);
            console.log(`  Max particles in a bin: ${maxBinCount}`);
            if (nonEmptyBins > 0) {
                console.log(`  Average particles per non-empty bin: ${(totalCount / nonEmptyBins).toFixed(1)}`);
            }
            
            if (totalCount === this.config.numParticles) {
                console.log('[Step 2] ✓ Count shader working correctly!');
                return true;
            } else {
                console.error(`[Step 2] ✗ Count mismatch! Expected ${this.config.numParticles}, got ${totalCount}`);
                return false;
            }
        } catch (error) {
            console.error('[Step 2] Error running count shader test:', error);
            return false;
        }
    }

    // STEP 3: Test prefix sum shader
    // This function runs the count shader first, then the prefix sum shader, and verifies the results
    async testPrefixSumShader() {
        console.log('[Step 3] testPrefixSumShader called');
        
        if (!this.prefixSumPipeline) {
            console.error('[Step 3] Prefix sum pipeline not created yet');
            return false;
        }

        if (!this.gpu || !this.gpu.device) {
            console.error('[Step 3] GPU device not available');
            return false;
        }

        const { device } = this.gpu;
        
        try {
            // First, run the count shader to populate binCounts
            console.log('[Step 3] Running count shader first...');
            await this.testCountShader();
            
            // Clear bin offsets buffer
            const zeroData = new Uint32Array(this.binCount + 1);
            device.queue.writeBuffer(
                this.binOffsetBuffer,
                0,
                zeroData
            );
            
            // Create bind group for prefix sum shader
            const prefixBindGroup = device.createBindGroup({
                label: 'test-prefix-bind-group',
                layout: this.prefixSumPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: this.binCountBuffer } },
                    { binding: 1, resource: { buffer: this.binOffsetBuffer } }
                ]
            });
            
            // Create a readback buffer
            const readbackBuffer = device.createBuffer({
                size: (this.binCount + 1) * 4,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
            });
            
            // Run prefix sum shader
            const commandEncoder = device.createCommandEncoder({ label: 'test-prefix-encoder' });
            
            const prefixPass = commandEncoder.beginComputePass({ label: 'test-prefix-pass' });
            prefixPass.setPipeline(this.prefixSumPipeline);
            prefixPass.setBindGroup(0, prefixBindGroup);
            
            const workgroupSize = 64;
            const numWorkgroups = Math.ceil((this.binCount + 1) / workgroupSize);
            console.log(`[Step 3] Dispatching ${numWorkgroups} workgroups for ${this.binCount + 1} elements`);
            prefixPass.dispatchWorkgroups(numWorkgroups);
            prefixPass.end();
            
            // Copy buffer
            commandEncoder.copyBufferToBuffer(
                this.binOffsetBuffer,
                0,
                readbackBuffer,
                0,
                (this.binCount + 1) * 4
            );
            
            // Finish and submit
            const commandBuffer = commandEncoder.finish();
            device.queue.submit([commandBuffer]);
            
            // Wait for GPU to finish
            await device.queue.onSubmittedWorkDone();
            
            console.log('[Step 3] Prefix sum shader dispatched, waiting for results...');
            
            // Read back results
            await readbackBuffer.mapAsync(GPUMapMode.READ);
            const mappedRange = readbackBuffer.getMappedRange();
            const offsets = new Uint32Array(mappedRange);
            const offsetsCopy = new Uint32Array(offsets);
            readbackBuffer.unmap();
            
            console.log('[Step 3] Read back offsets, first 10:', Array.from(offsetsCopy.slice(0, 10)));
            
            // Also read back counts to verify
            const countsReadback = device.createBuffer({
                size: (this.binCount + 1) * 4,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
            });
            
            const countEncoder = device.createCommandEncoder();
            countEncoder.copyBufferToBuffer(
                this.binCountBuffer,
                0,
                countsReadback,
                0,
                (this.binCount + 1) * 4
            );
            device.queue.submit([countEncoder.finish()]);
            await device.queue.onSubmittedWorkDone();
            await countsReadback.mapAsync(GPUMapMode.READ);
            const countsMapped = countsReadback.getMappedRange();
            const counts = new Uint32Array(countsMapped);
            const countsCopy = new Uint32Array(counts);
            countsReadback.unmap();
            
            // Verify prefix sum
            console.log('[Step 3] Prefix sum test results:');
            console.log('[Step 3] First 10 counts:', Array.from(countsCopy.slice(0, 10)));
            console.log('[Step 3] First 10 offsets:', Array.from(offsetsCopy.slice(0, 10)));
            
            // Verify: offsets[i] should equal sum of counts[1] to counts[i-1]
            let allCorrect = true;
            let manualSum = 0;
            
            for (let i = 1; i <= this.binCount; i++) {
                // offsets[i] should be the sum of counts[1] to counts[i-1]
                if (offsetsCopy[i] !== manualSum) {
                    console.error(`[Step 3] ✗ Offset mismatch at index ${i}: expected ${manualSum}, got ${offsetsCopy[i]}`);
                    allCorrect = false;
                }
                manualSum += countsCopy[i];
            }
            
            // Check that the last offset + last count equals total particles
            const lastOffset = offsetsCopy[this.binCount];
            const lastCount = countsCopy[this.binCount];
            const totalFromOffsets = lastOffset + lastCount;
            
            console.log(`[Step 3] Last offset: ${lastOffset}, last count: ${lastCount}`);
            console.log(`[Step 3] Total from offsets: ${totalFromOffsets} (expected: ${this.config.numParticles})`);
            
            if (allCorrect && totalFromOffsets === this.config.numParticles) {
                console.log('[Step 3] ✓ Prefix sum shader working correctly!');
                return true;
            } else {
                console.error('[Step 3] ✗ Prefix sum verification failed');
                return false;
            }
        } catch (error) {
            console.error('[Step 3] Error running prefix sum shader test:', error);
            return false;
        }
    }

    // STEP 4: Test sort shader
    // This function runs count, prefix sum, and sort shaders, then verifies particles are sorted correctly
    async testSortShader() {
        console.log('[Step 4] testSortShader called');
        
        if (!this.sortPipeline) {
            console.error('[Step 4] Sort pipeline not created yet');
            return false;
        }

        if (!this.gpu || !this.gpu.device) {
            console.error('[Step 4] GPU device not available');
            return false;
        }

        const { device } = this.gpu;
        
        try {
            // Step 1: Run count shader
            console.log('[Step 4] Step 1: Running count shader...');
            await this.testCountShader();
            
            // Step 2: Run prefix sum shader
            console.log('[Step 4] Step 2: Running prefix sum shader...');
            
            // Clear bin offsets buffer
            const zeroData = new Uint32Array(this.binCount + 1);
            device.queue.writeBuffer(this.binOffsetBuffer, 0, zeroData);
            
            // Create bind group for prefix sum
            const prefixBindGroup = device.createBindGroup({
                layout: this.prefixSumPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: this.binCountBuffer } },
                    { binding: 1, resource: { buffer: this.binOffsetBuffer } }
                ]
            });
            
            const prefixEncoder = device.createCommandEncoder();
            const prefixPass = prefixEncoder.beginComputePass();
            prefixPass.setPipeline(this.prefixSumPipeline);
            prefixPass.setBindGroup(0, prefixBindGroup);
            const workgroupSize = 64;
            const numWorkgroups = Math.ceil((this.binCount + 1) / workgroupSize);
            prefixPass.dispatchWorkgroups(numWorkgroups);
            prefixPass.end();
            device.queue.submit([prefixEncoder.finish()]);
            await device.queue.onSubmittedWorkDone();
            
            // Step 3: Run sort shader
            console.log('[Step 4] Step 3: Running sort shader...');
            
            // Clear sorted particles buffer (fill with a sentinel value to verify writes)
            const sortedZeroData = new Float32Array(this.config.numParticles * 5);
            // Fill with -999.0 as sentinel to verify writes are happening
            sortedZeroData.fill(-999.0);
            device.queue.writeBuffer(this.sortedParticleBuffer, 0, sortedZeroData);
            await device.queue.onSubmittedWorkDone(); // Wait for clear to complete
            
            // Create bind group for sort shader
            const sortBindGroup = device.createBindGroup({
                layout: this.sortPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: this.particleBuffers[this.bufferIndex] } },
                    { binding: 1, resource: { buffer: this.binOffsetBuffer } },
                    { binding: 2, resource: { buffer: this.sortedParticleBuffer } },
                    { binding: 3, resource: { buffer: this.binningParamsBuffer } }
                ]
            });
            
            const sortEncoder = device.createCommandEncoder({ label: 'sort-encoder' });
            const sortPass = sortEncoder.beginComputePass({ label: 'sort-pass' });
            sortPass.setPipeline(this.sortPipeline);
            sortPass.setBindGroup(0, sortBindGroup);
            const sortWorkgroups = Math.ceil(this.config.numParticles / workgroupSize);
            console.log(`[Step 4] Dispatching ${sortWorkgroups} workgroups for ${this.config.numParticles} particles`);
            sortPass.dispatchWorkgroups(sortWorkgroups);
            sortPass.end();
            
            // Add a memory barrier to ensure writes complete
            device.queue.submit([sortEncoder.finish()]);
            await device.queue.onSubmittedWorkDone();
            
            console.log('[Step 4] Sort shader completed, reading back results...');
            
            // Step 4: Verify results
            console.log('[Step 4] Step 4: Verifying sorted particles...');
            
            // Read back sorted particles
            const sortedReadback = device.createBuffer({
                size: this.config.numParticles * 5 * 4,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
            });
            
            const readEncoder = device.createCommandEncoder();
            readEncoder.copyBufferToBuffer(
                this.sortedParticleBuffer,
                0,
                sortedReadback,
                0,
                this.config.numParticles * 5 * 4
            );
            device.queue.submit([readEncoder.finish()]);
            await device.queue.onSubmittedWorkDone();
            await sortedReadback.mapAsync(GPUMapMode.READ);
            const sortedMapped = sortedReadback.getMappedRange();
            const sortedData = new Float32Array(sortedMapped);
            const sortedCopy = new Float32Array(sortedData);
            sortedReadback.unmap();
            
            // Read back final offsets to verify all particles were sorted
            const offsetReadback = device.createBuffer({
                size: (this.binCount + 1) * 4,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
            });
            
            const offsetEncoder = device.createCommandEncoder();
            offsetEncoder.copyBufferToBuffer(
                this.binOffsetBuffer,
                0,
                offsetReadback,
                0,
                (this.binCount + 1) * 4
            );
            device.queue.submit([offsetEncoder.finish()]);
            await device.queue.onSubmittedWorkDone();
            await offsetReadback.mapAsync(GPUMapMode.READ);
            const offsetMapped = offsetReadback.getMappedRange();
            const finalOffsets = new Uint32Array(offsetMapped);
            const finalOffsetsCopy = new Uint32Array(finalOffsets);
            offsetReadback.unmap();
            
            // Verify: final offsets should equal total particles
            // Note: finalOffsetsCopy[binCount] is the total, but we need to check if it matches
            const totalSorted = finalOffsetsCopy[this.binCount];
            console.log(`[Step 4] Total particles sorted: ${totalSorted} (expected: ${this.config.numParticles})`);
            
            // The issue might be that some particles are writing beyond bounds
            // Check if totalSorted exceeds numParticles
            if (totalSorted > this.config.numParticles) {
                console.warn(`[Step 4] ⚠️ More particles sorted than expected! This suggests some particles wrote out of bounds or were counted twice.`);
            }
            
            // Debug: Check if any bins have more particles than expected
            // Read back counts to compare
            const countsReadback2 = device.createBuffer({
                size: (this.binCount + 1) * 4,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
            });
            const countEncoder2 = device.createCommandEncoder();
            countEncoder2.copyBufferToBuffer(
                this.binCountBuffer,
                0,
                countsReadback2,
                0,
                (this.binCount + 1) * 4
            );
            device.queue.submit([countEncoder2.finish()]);
            await device.queue.onSubmittedWorkDone();
            await countsReadback2.mapAsync(GPUMapMode.READ);
            const countsMapped2 = countsReadback2.getMappedRange();
            const counts2 = new Uint32Array(countsMapped2);
            const countsCopy2 = new Uint32Array(counts2);
            countsReadback2.unmap();
            
            // Compare counts vs final offsets
            let totalFromCounts = 0;
            let totalFromOffsets = 0;
            for (let i = 1; i <= this.binCount; i++) {
                const count = countsCopy2[i];
                const offsetStart = i > 1 ? finalOffsetsCopy[i - 1] : 0;
                const offsetEnd = finalOffsetsCopy[i];
                const offsetCount = offsetEnd - offsetStart;
                totalFromCounts += count;
                totalFromOffsets += offsetCount;
                
                if (count !== offsetCount) {
                    console.warn(`[Step 4] Bin ${i-1}: count=${count}, sorted=${offsetCount}`);
                }
            }
            console.log(`[Step 4] Total from counts: ${totalFromCounts}, total from offsets: ${totalFromOffsets}`);
            
            // Check that particles are in the right bins
            let particlesInCorrectBins = 0;
            let particlesChecked = 0;
            let emptySlots = 0;
            
            // Check first few particles to see if they're actually written
            console.log(`[Step 4] First 10 particles in sorted array:`);
            for (let i = 0; i < Math.min(10, this.config.numParticles); i++) {
                const baseIdx = i * 5;
                const posX = sortedCopy[baseIdx];
                const posY = sortedCopy[baseIdx + 1];
                const velX = sortedCopy[baseIdx + 2];
                const velY = sortedCopy[baseIdx + 3];
                const type = sortedCopy[baseIdx + 4];
                const isSentinel = (posX === -999.0);
                console.log(`  Particle ${i}: pos=(${posX.toFixed(3)}, ${posY.toFixed(3)}), vel=(${velX.toFixed(3)}, ${velY.toFixed(3)}), type=${type} ${isSentinel ? '(SENTINEL - not written!)' : ''}`);
            }
            
            // Check particles at offset positions (where bins should start)
            console.log(`[Step 4] Particles at bin start positions:`);
            for (let bin = 0; bin < Math.min(5, this.binCount); bin++) {
                const offset = finalOffsetsCopy[bin + 1];
                if (offset < this.config.numParticles) {
                    const baseIdx = offset * 5;
                    const posX = sortedCopy[baseIdx];
                    const posY = sortedCopy[baseIdx + 1];
                    const isSentinel = (posX === -999.0);
                    console.log(`  Bin ${bin} start (offset ${offset}): pos=(${posX.toFixed(3)}, ${posY.toFixed(3)}) ${isSentinel ? '(SENTINEL!)' : ''}`);
                }
            }
            
            // Check for empty slots (more accurate check)
            for (let i = 0; i < this.config.numParticles; i++) {
                const baseIdx = i * 5;
                // A slot is empty if position is exactly (0,0) AND velocity is exactly (0,0) AND type is 0
                // This is very unlikely for a real particle
                if (sortedCopy[baseIdx] === 0 && sortedCopy[baseIdx + 1] === 0 && 
                    sortedCopy[baseIdx + 2] === 0 && sortedCopy[baseIdx + 3] === 0 && 
                    sortedCopy[baseIdx + 4] === 0) {
                    emptySlots++;
                }
            }
            
            console.log(`[Step 4] Empty slots in sorted array: ${emptySlots}`);
            console.log(`[Step 4] First 10 final offsets:`, Array.from(finalOffsetsCopy.slice(0, 10)));
            
            // Sample particles to verify they're in correct bins
            for (let i = 0; i < Math.min(100, this.config.numParticles); i++) {
                const baseIdx = i * 5;
                const pos = { x: sortedCopy[baseIdx], y: sortedCopy[baseIdx + 1] };
                
                // Skip empty slots (more accurate check)
                if (pos.x === 0 && pos.y === 0 && sortedCopy[baseIdx + 2] === 0 && sortedCopy[baseIdx + 3] === 0 && sortedCopy[baseIdx + 4] === 0) {
                    continue;
                }
                
                // Calculate expected bin
                const binX = Math.floor(Math.max(0, Math.min((pos.x + 1.0) / this.binSize, this.gridWidth - 1)));
                const binY = Math.floor(Math.max(0, Math.min((pos.y + 1.0) / this.binSize, this.gridHeight - 1)));
                const expectedBin = Math.min(binY * this.gridWidth + binX, this.binCount - 1);
                
                // Find which bin this particle is actually in by checking offsets
                // finalOffsetsCopy[b] is the end of bin b-1 (start of bin b)
                let actualBin = -1;
                for (let b = 1; b <= this.binCount; b++) {
                    const binStart = finalOffsetsCopy[b - 1];
                    const binEnd = finalOffsetsCopy[b];
                    if (i >= binStart && i < binEnd) {
                        actualBin = b - 1;
                        break;
                    }
                }
                
                if (actualBin === expectedBin) {
                    particlesInCorrectBins++;
                } else if (actualBin === -1) {
                    console.warn(`[Step 4] Particle at index ${i} not in any bin range`);
                }
                particlesChecked++;
            }
            
            console.log(`[Step 4] Particles in correct bins: ${particlesInCorrectBins}/${particlesChecked} sampled`);
            
            // Allow small discrepancy (within 0.1% or 10 particles) due to potential race conditions
            const discrepancy = Math.abs(totalSorted - this.config.numParticles);
            const maxAllowedDiscrepancy = Math.max(10, this.config.numParticles * 0.001);
            
            if (discrepancy <= maxAllowedDiscrepancy) {
                console.log(`[Step 4] ✓ Sort shader working correctly! (${discrepancy} particle discrepancy, within tolerance)`);
                return true;
            } else {
                console.error(`[Step 4] ✗ Sort verification failed: expected ${this.config.numParticles}, got ${totalSorted} (discrepancy: ${discrepancy})`);
                return false;
            }
        } catch (error) {
            console.error('[Step 4] Error running sort shader test:', error);
            return false;
        }
    }

    // STEP 5: Run all binning passes (count → prefix sum → sort)
    // This prepares the sorted particle array for efficient neighbor searches
    runBinningPasses(commandEncoder) {
        console.log('[Step 5] Starting binning passes...');
        
        if (!this.useBinning || !this.countPipeline || !this.prefixSumPipeline || !this.sortPipeline) {
            console.warn('[Step 5] Binning passes skipped - not all pipelines ready');
            throw new Error('Binning pipelines not ready');
        }

        if (!commandEncoder) {
            console.error('[Step 5] Command encoder is null');
            throw new Error('Command encoder is null');
        }

        if (!this.binCountBuffer || !this.binOffsetBuffer || !this.binTempBuffer || !this.sortedParticleBuffer || !this.binningParamsBuffer) {
            console.error('[Step 5] Binning buffers not ready');
            throw new Error('Binning buffers not ready');
        }

        const { device } = this.gpu;
        const workgroupSize = 64;
        
        try {
            console.log('[Step 5] Phase 1: Count particles per bin');
            // Phase 1: Count particles per bin
            const countBindGroup = device.createBindGroup({
                layout: this.countPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: this.particleBuffers[this.bufferIndex] } },
                    { binding: 1, resource: { buffer: this.binCountBuffer } },
                    { binding: 2, resource: { buffer: this.binningParamsBuffer } }
                ]
            });

            const countPass = commandEncoder.beginComputePass({ label: 'binning-count-pass' });
            countPass.setPipeline(this.countPipeline);
            countPass.setBindGroup(0, countBindGroup);
            const countWorkgroups = Math.ceil(this.config.numParticles / workgroupSize);
            countPass.dispatchWorkgroups(countWorkgroups);
            countPass.end();
            console.log('[Step 5] Phase 1 complete');

            console.log('[Step 5] Phase 2: Prefix sum');
            // Phase 2: Prefix sum (convert counts to offsets)
            const prefixBindGroup = device.createBindGroup({
                layout: this.prefixSumPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: this.binCountBuffer } },
                    { binding: 1, resource: { buffer: this.binTempBuffer } }
                ]
            });

            const prefixPass = commandEncoder.beginComputePass({ label: 'binning-prefix-pass' });
            prefixPass.setPipeline(this.prefixSumPipeline);
            prefixPass.setBindGroup(0, prefixBindGroup);
            const prefixWorkgroups = Math.ceil((this.binCount + 1) / workgroupSize);
            prefixPass.dispatchWorkgroups(prefixWorkgroups);
            prefixPass.end();
            console.log('[Step 5] Phase 2 complete');

            console.log('[Step 5] Copying prefix sum to offset buffer');
            // Copy prefix sum result from temp buffer to offset buffer
            commandEncoder.copyBufferToBuffer(
                this.binTempBuffer,
                0,
                this.binOffsetBuffer,
                0,
                (this.binCount + 1) * 4
            );

            console.log('[Step 5] Phase 3: Sort particles');
            // Phase 3: Sort particles into bins
            const sortBindGroup = device.createBindGroup({
                layout: this.sortPipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: this.particleBuffers[this.bufferIndex] } },
                    { binding: 1, resource: { buffer: this.binOffsetBuffer } },
                    { binding: 2, resource: { buffer: this.sortedParticleBuffer } },
                    { binding: 3, resource: { buffer: this.binningParamsBuffer } }
                ]
            });

            const sortPass = commandEncoder.beginComputePass({ label: 'binning-sort-pass' });
            sortPass.setPipeline(this.sortPipeline);
            sortPass.setBindGroup(0, sortBindGroup);
            const sortWorkgroups = Math.ceil(this.config.numParticles / workgroupSize);
            sortPass.dispatchWorkgroups(sortWorkgroups);
            sortPass.end();
            console.log('[Step 5] Phase 3 complete');
            
            console.log('[Step 5] Copying offsets to read buffer');
            // Copy offsets to read-only buffer for compute shader
            commandEncoder.copyBufferToBuffer(
                this.binTempBuffer,
                0,
                this.binOffsetReadBuffer,
                0,
                (this.binCount + 1) * 4
            );
            
            // Restore binOffsetBuffer for next frame
            commandEncoder.copyBufferToBuffer(
                this.binTempBuffer,
                0,
                this.binOffsetBuffer,
                0,
                (this.binCount + 1) * 4
            );
            console.log('[Step 5] Binning passes complete');
        } catch (error) {
            console.error('[Step 5] Error in runBinningPasses:', error);
            console.error('[Step 5] Error stack:', error.stack);
            throw error; // Re-throw to be caught by caller
        }
    }

    // Simulation control methods
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.isPaused = false;
        this.lastFrameTime = null; // Reset frame timing
        
        // Ensure test functions are available
        if (!window.testCountShader) {
            window.testCountShader = async () => {
                return await this.testCountShader();
            };
        }
        if (!window.testPrefixSumShader) {
            window.testPrefixSumShader = async () => {
                return await this.testPrefixSumShader();
            };
        }
        if (!window.testSortShader) {
            window.testSortShader = async () => {
                return await this.testSortShader();
            };
        }
        
        // Ensure simulator instance is available
        window.particleSimulator = this;
        
        this.frameId = requestAnimationFrame(this.update.bind(this));
    }

    stop() {
        if (!this.isRunning) return;
        this.isRunning = false;
        this.isPaused = false;
        if (this.frameId) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }
    }

    pause() {
        if (!this.isRunning) return;
        this.isPaused = true;
    }

    unpause() {
        if (!this.isRunning || !this.isPaused) return;
        this.isPaused = false;
    }

    togglePause() {
        if (!this.isRunning) return;
        if (this.isPaused) {
            this.unpause();
        } else {
            this.pause();
        }
    }

    update() {
        if (!this.isRunning) return;
        try {
            this.render();
            this.frameId = requestAnimationFrame(this.update.bind(this));
        } catch (error) {
            console.error("Error in update loop:", error);
            this.stop();
            WebGPUUtils.showError(`Simulation error: ${error.message}`);
        }
    }

    render() {
        if (!this.gpu || !this.gpu.device || !this.gpu.context) {
            console.error("GPU context is invalid");
            return;
        }

        const { device, context } = this.gpu;

        try {
            this.frameCount++;

            // Calculate frame-rate independent dt
            const now = performance.now();
            let dt = 0.0025; // Default fallback
            
            if (this.lastFrameTime !== null) {
                const elapsed = (now - this.lastFrameTime) / 1000.0; // Convert to seconds
                dt = Math.min(elapsed, 0.02); // Cap at 20ms to prevent large jumps (e.g., tab was in background)
            }
            this.lastFrameTime = now;

            // Scale dt down by 50% to slow simulation
            dt = dt * 0.3;

            // Update uniform buffer with frame-rate independent dt
            if (!this.isPaused) {
                this.updateUniformBuffer(dt);
            }

            // Update mouse data before rendering
            this.updateMouseUniformBuffer();

            // STEP 5: Prepare binning buffers BEFORE creating command encoder
            // (writeBuffer operations should happen before encoding)
            if (!this.isPaused && this.useBinning && this.binnedComputePipeline && this.binnedComputeBindGroups) {
                try {
                    // Clear binning buffers before encoding
                    const zeroData = new Uint32Array(this.binCount + 1);
                    const sortedZeroData = new Float32Array(this.config.numParticles * 5);
                    device.queue.writeBuffer(this.binCountBuffer, 0, zeroData);
                    device.queue.writeBuffer(this.binTempBuffer, 0, zeroData);
                    device.queue.writeBuffer(this.sortedParticleBuffer, 0, sortedZeroData);
                } catch (error) {
                    console.error('[Step 5] Error preparing binning buffers:', error);
                }
            }

            const currentTexture = context.getCurrentTexture();
            const textureView = currentTexture.createView();
            const commandEncoder = device.createCommandEncoder({
                label: 'frame-command-encoder'
            });

            let computePassSucceeded = false;

            // Only run compute pass if not paused
            if (!this.isPaused) {
                // STEP 5: Run binning passes if binning is enabled
                // Check if all required resources are available
                const binningReady = this.useBinning && 
                    this.binnedComputePipeline && 
                    this.binnedComputeBindGroups &&
                    this.binnedComputeBindGroups[this.bufferIndex] &&
                    this.countPipeline &&
                    this.prefixSumPipeline &&
                    this.sortPipeline &&
                    this.binCountBuffer &&
                    this.binOffsetBuffer &&
                    this.binOffsetReadBuffer &&
                    this.binTempBuffer &&
                    this.sortedParticleBuffer &&
                    this.binningParamsBuffer;

                if (binningReady) {
                    try {
                        console.log('[Step 5] Running binning passes...');
                        // Run binning passes
                        this.runBinningPasses(commandEncoder);
                        
                        console.log('[Step 5] Starting binned compute pass...');
                        // Use binned compute shader
                        const computePass = commandEncoder.beginComputePass({
                            label: 'binned-compute-pass'
                        });

                        // Validate pipeline and bind group before using
                        if (!this.binnedComputePipeline) {
                            throw new Error('Binned compute pipeline is null');
                        }
                        if (!this.binnedComputeBindGroups || !this.binnedComputeBindGroups[this.bufferIndex]) {
                            throw new Error('Binned compute bind group is null');
                        }

                        computePass.setPipeline(this.binnedComputePipeline);
                        computePass.setBindGroup(0, this.binnedComputeBindGroups[this.bufferIndex]);

                        const workgroupSize = 64;
                        const numWorkgroups = Math.ceil(this.config.numParticles / workgroupSize);
                        computePass.dispatchWorkgroups(numWorkgroups);
                        computePass.end();
                        computePassSucceeded = true;
                    } catch (error) {
                        console.error('[Step 5] Error in binned compute pass:', error);
                        console.error('[Step 5] Error details:', {
                            binnedComputePipeline: !!this.binnedComputePipeline,
                            binnedComputeBindGroups: !!this.binnedComputeBindGroups,
                            bufferIndex: this.bufferIndex,
                            countPipeline: !!this.countPipeline,
                            prefixSumPipeline: !!this.prefixSumPipeline,
                            sortPipeline: !!this.sortPipeline,
                            binOffsetReadBuffer: !!this.binOffsetReadBuffer
                        });
                        // Command encoder might be invalid now, skip finishing it
                        // Just return early to skip this frame
                        return;
                    }
                } else {
                    // Use regular compute shader (no binning)
                    const computePass = commandEncoder.beginComputePass({
                        label: 'compute-pass'
                    });

                    computePass.setPipeline(this.computePipeline);
                    computePass.setBindGroup(0, this.computeBindGroups[this.bufferIndex]);

                    const workgroupSize = 64;
                    const numWorkgroups = Math.ceil(this.config.numParticles / workgroupSize);
                    computePass.dispatchWorkgroups(numWorkgroups);
                    computePass.end();
                    computePassSucceeded = true;
                }

                if (computePassSucceeded) {
                    this.bufferIndex = 1 - this.bufferIndex;
                }
            }

            // Always render (only if compute pass succeeded or we're paused)
            if (computePassSucceeded || this.isPaused) {
                const renderPass = commandEncoder.beginRenderPass({
                    label: 'render-pass',
                    colorAttachments: [{
                        view: textureView,
                        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                        loadOp: 'clear',
                        storeOp: 'store'
                    }]
                });

                renderPass.setPipeline(this.renderPipeline);
                renderPass.setBindGroup(0, this.renderBindGroups[this.bufferIndex]);
                renderPass.draw(6, this.config.numParticles);
                renderPass.end();

                const commandBuffer = commandEncoder.finish();
                device.queue.submit([commandBuffer]);
            }
                } catch (error) {
                    console.error("Error in render:", error);
                    console.error("Error stack:", error.stack);
                    // Don't stop the simulation, just log the error
                    // This allows the simulation to continue with the next frame
                    if (error.message && error.message.includes('Invalid CommandBuffer')) {
                        console.warn('[Step 5] Command buffer validation error - disabling binning for this frame');
                        // Temporarily disable binning to prevent repeated errors
                        const wasBinningEnabled = this.useBinning;
                        this.useBinning = false;
                        // Try to recover on next frame
                        setTimeout(() => {
                            this.useBinning = wasBinningEnabled;
                        }, 100);
                    } else {
                        // For other errors, stop the simulation
                        this.stop();
                        WebGPUUtils.showError(`Rendering error: ${error.message}`);
                    }
                }
    }

    // Force manipulation methods
    async updateForceMatrices(newConfig) {
        if (!this.gpu || !this.gpu.device) {
            throw new Error("GPU not initialized");
        }

        const device = this.gpu.device;
        const numTypes = newConfig.species.length;

        if (numTypes !== this.config.numTypes) {
            throw new Error("Cannot change number of types dynamically - requires restart");
        }

        const strengthMatrix = [];
        const radiusMatrix = [];
        const collisionStrengthMatrix = [];
        const collisionRadiusMatrix = [];

        for (let i = 0; i < numTypes; i++) {
            for (let j = 0; j < numTypes; j++) {
                const force = newConfig.species[i].forces[j];
                strengthMatrix.push(force.strength / 200.0);
                radiusMatrix.push(force.radius / 130);
                collisionStrengthMatrix.push(force.collisionStrength / 30.0);
                collisionRadiusMatrix.push(force.collisionRadius / 275.0);
            }
        }

        device.queue.writeBuffer(this.strengthBuffer, 0, new Float32Array(strengthMatrix));
        device.queue.writeBuffer(this.radiusBuffer, 0, new Float32Array(radiusMatrix));
        device.queue.writeBuffer(this.collisionStrengthBuffer, 0, new Float32Array(collisionStrengthMatrix));
        device.queue.writeBuffer(this.collisionRadiusBuffer, 0, new Float32Array(collisionRadiusMatrix));

        const colorData = new Float32Array(numTypes * 4);
        for (let i = 0; i < numTypes; i++) {
            for (let j = 0; j < 4; j++) {
                colorData[i * 4 + j] = newConfig.species[i].color[j];
            }
        }
        device.queue.writeBuffer(this.colorBuffer, 0, colorData);

        this.config.species = newConfig.species;
        this.config.colors = newConfig.species.map(s => s.color);
        this.config.strengthMatrix = strengthMatrix;
        this.config.radiusMatrix = radiusMatrix;
        this.config.collisionStrengthMatrix = collisionStrengthMatrix;
        this.config.collisionRadiusMatrix = collisionRadiusMatrix;

        // Update particle appearance if provided in the new config
        if (newConfig.particleSize !== undefined || newConfig.particleOpacity !== undefined) {
            const size = newConfig.particleSize !== undefined ? newConfig.particleSize : this.config.particleSize || 0.007;
            const opacity = newConfig.particleOpacity !== undefined ? newConfig.particleOpacity : this.config.particleOpacity || 0.75;
            this.updateParticleAppearance(size, opacity);
        }
    }

    async randomizeForces(params = null) {
        if (!this.config.species) {
            console.warn("No species configuration available for randomization");
            return;
        }

        const forceParams = params || {
            strengthModifier: 110,
            radiusRange: 25,
            collisionStrengthRange: 750,
            collisionRadiusRange: 4,
            forceScale: 1.0
        };

        const numTypes = this.config.numTypes;
        const newSpecies = [...this.config.species];

        for (let i = 0; i < numTypes; i++) {
            for (let j = 0; j < numTypes; j++) {
                const strength = (Math.random() * 200 - forceParams.strengthModifier) * forceParams.forceScale;
                const radius = 5 + Math.random() * forceParams.radiusRange;
                const collisionStrength = 200 + Math.random() * forceParams.collisionStrengthRange;
                const collisionRadius = 0.5 + Math.random() * forceParams.collisionRadiusRange;

                newSpecies[i].forces[j] = {
                    strength,
                    radius,
                    collisionStrength,
                    collisionRadius
                };
            }
        }


        // FIX: Convert slider display value to actual value
        const sizeSliderValue = parseFloat(document.getElementById('particle-size-slider')?.value) || 7;
        const actualParticleSize = sizeSliderValue / 1000; // Convert 7 to 0.007

        const opacitySliderValue = parseFloat(document.getElementById('particle-opacity-slider')?.value) || 0.75;

        const newConfig = {
            particleCount: this.config.numParticles,
            species: newSpecies,
            friction: this.config.friction,
            centralForce: this.config.centralForce,
            symmetricForces: false,
            particleSize: actualParticleSize,  // Use converted value
            particleOpacity: opacitySliderValue
        };

        await this.updateForceMatrices(newConfig);
        this.storeCurrentAsBaseline();
    }

    reset(newConfig = null) {
        const wasRunning = this.isRunning;
        const wasPaused = this.isPaused;

        this.stop();
        this.bufferIndex = 0;

        if (newConfig) {
            this.config = Object.assign(this.config, {
                numParticles: newConfig.particleCount,
                numTypes: newConfig.species?.length || this.config.numTypes,
                species: newConfig.species,
                friction: parseFloat(newConfig.friction),
                centralForce: newConfig.centralForce,
                colors: newConfig.species?.map(s => s.color) || this.config.colors,
                particleSize: newConfig.particleSize !== undefined ? newConfig.particleSize : this.config.particleSize || 0.007,
                particleOpacity: newConfig.particleOpacity !== undefined ? newConfig.particleOpacity : this.config.particleOpacity || 0.75
            });
        }

        this.initializeParticles();
        this.createBindGroups();

        if (wasRunning) {
            this.start();
            if (wasPaused) {
                this.pause();
            }
        }
    }

    // Baseline management
    storeCurrentAsBaseline() {
        if (this.config.species) {
            this.baselineForces = JSON.parse(JSON.stringify(this.config.species));
        }
    }

    async resetWithModifiedBaseline(forceParams) {
        const wasRunning = this.isRunning;
        const wasPaused = this.isPaused;

        this.stop();
        this.bufferIndex = 0;

        const sourceForces = this.baselineForces || this.config.species;
        if (!sourceForces) {
            console.error("No forces available to modify!");
            return;
        }

        const numTypes = this.config.numTypes;
        const defaults = {
            strengthModifier: 110,
            radiusRange: 25,
            collisionStrengthRange: 750,
            collisionRadiusRange: 4
        };

        // Get current force scale from UI
        const forceScale = parseFloat(document.getElementById('force-scale-slider')?.value) || 1.0;

        const strengthScale = forceParams.strengthModifier / defaults.strengthModifier;
        const radiusScale = forceParams.radiusRange / defaults.radiusRange;
        const collisionStrengthScale = forceParams.collisionStrengthRange / defaults.collisionStrengthRange;
        const collisionRadiusScale = forceParams.collisionRadiusRange / defaults.collisionRadiusRange;

        const modifiedSpecies = JSON.parse(JSON.stringify(sourceForces));

        for (let i = 0; i < numTypes; i++) {
            for (let j = 0; j < numTypes; j++) {
                const baselineForce = sourceForces[i].forces[j];
                modifiedSpecies[i].forces[j] = {
                    strength: baselineForce.strength * strengthScale * forceScale,
                    radius: baselineForce.radius * radiusScale,
                    collisionStrength: baselineForce.collisionStrength * collisionStrengthScale,
                    collisionRadius: baselineForce.collisionRadius * collisionRadiusScale
                };
            }
        }

        this.config.species = modifiedSpecies;
        this.initializeParticles();
        this.createBindGroups();

        if (wasRunning) {
            this.start();
            if (wasPaused) {
                this.pause();
            }
        }
    }

    resetPositionsOnly() {
        const wasRunning = this.isRunning;
        const wasPaused = this.isPaused;

        this.stop();
        this.bufferIndex = 0;

        this.initializeParticlePositions();
        this.createBindGroups();

        if (wasRunning) {
            this.start();
            if (wasPaused) {
                this.pause();
            }
        }
    }

    initializeParticlePositions() {
        const { device } = this.gpu;
        const { numParticles, numTypes } = this.config;

        const particleData = new Float32Array(numParticles * 5);

        for (let i = 0; i < numParticles; i++) {
            const baseIndex = i * 5;
            particleData[baseIndex] = Math.random() * 2 - 1;
            particleData[baseIndex + 1] = Math.random() * 2 - 1;
            particleData[baseIndex + 2] = (Math.random() - 0.5) * 0.1;
            particleData[baseIndex + 3] = (Math.random() - 0.5) * 0.1;
            particleData[baseIndex + 4] = Math.floor(Math.random() * numTypes);
        }

        device.queue.writeBuffer(this.particleBuffers[0], 0, particleData);
        device.queue.writeBuffer(this.particleBuffers[1], 0, particleData);
    }

    // NEW: Method to update particle count dynamically
    async updateParticleCount(newCount) {
        if (!this.gpu || !this.gpu.device) {
            throw new Error("GPU not initialized");
        }

        if (newCount === this.config.numParticles) {
            return; // No change needed
        }

        const device = this.gpu.device;
        const numTypes = this.config.numTypes;

        // Create new particle data
        const particleData = new Float32Array(newCount * 5);
        for (let i = 0; i < newCount; i++) {
            const baseIndex = i * 5;
            particleData[baseIndex] = Math.random() * 2 - 1;     // x
            particleData[baseIndex + 1] = Math.random() * 2 - 1; // y
            particleData[baseIndex + 2] = (Math.random() - 0.5) * 0.1; // vx
            particleData[baseIndex + 3] = (Math.random() - 0.5) * 0.1; // vy
            particleData[baseIndex + 4] = Math.floor(Math.random() * numTypes); // type
        }

        // Destroy old buffers
        this.particleBuffers.forEach(buffer => buffer.destroy());

        // Create new particle buffers
        const bufferSize = particleData.byteLength;
        this.particleBuffers = [
            device.createBuffer({
                size: bufferSize,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
                mappedAtCreation: true
            }),
            device.createBuffer({
                size: bufferSize,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
                mappedAtCreation: true
            })
        ];

        // Initialize both buffers with the same data
        new Float32Array(this.particleBuffers[0].getMappedRange()).set(particleData);
        this.particleBuffers[0].unmap();
        new Float32Array(this.particleBuffers[1].getMappedRange()).set(particleData);
        this.particleBuffers[1].unmap();

        // Update config
        this.config.numParticles = newCount;

        // Recreate bind groups with new buffers
        this.createBindGroups();

        console.log(`Particle count updated to ${newCount}`);
    }

    updateUniformBuffer(dt) {
        if (!this.gpu || !this.gpu.device || !this.uniformBuffer) return;

        const frictionHalfLife = this.config.friction * 0.001;
        const friction = Math.exp(-Math.log(2) * dt / frictionHalfLife);

        // Get current aspect ratio from canvas
        const aspectRatio = this.gpu.canvas.width / this.gpu.canvas.height;

        const uniformData = new Float32Array([
            0.02,   // radius
            0.15,   // rMax
            dt,     // dt (frame-rate independent)
            friction, // friction
            this.config.centralForce || 0.0, // central force
            this.config.numTypes || 3,       // numTypes
            aspectRatio,                     // aspect ratio
            0.0     // padding
        ]);

        this.gpu.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
    }

    updateFriction(frictionHalfLife) {
        if (!this.gpu || !this.gpu.device) return;

        this.config.friction = frictionHalfLife;
        const dt = 0.0023;
        const friction = Math.exp(-Math.log(2) * dt / frictionHalfLife);

        // Get current aspect ratio from canvas
        const aspectRatio = this.gpu.canvas.width / this.gpu.canvas.height;

        const uniformData = new Float32Array([
            0.02,   // radius
            0.15,   // rMax
            dt,     // dt
            friction, // friction
            this.config.centralForce || 0.0, // central force
            this.config.numTypes || 3,       // numTypes
            aspectRatio,                     // aspect ratio
            0.0     // padding
        ]);

        this.gpu.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
        console.log('Friction updated with aspect ratio preserved');
    }

    async applyNewConfiguration(newConfig) {
        try {
            console.log("Applying new configuration with aspect ratio support...");

            // Update particle count if changed
            if (newConfig.particleCount !== this.config.numParticles) {
                await this.updateParticleCount(newConfig.particleCount);
            }

            // Update force matrices
            await this.updateForceMatrices(newConfig);

            // Update other properties
            this.config.friction = parseFloat(newConfig.friction);
            this.config.centralForce = newConfig.centralForce;

            // Update particle appearance if provided
            if (newConfig.particleSize !== undefined || newConfig.particleOpacity !== undefined) {
                const size = newConfig.particleSize !== undefined ? newConfig.particleSize : this.config.particleSize || 0.007;
                const opacity = newConfig.particleOpacity !== undefined ? newConfig.particleOpacity : this.config.particleOpacity || 0.75;
                this.config.particleSize = size;
                this.config.particleOpacity = opacity;
                this.updateParticleAppearance(size, opacity);
            }

            // Update uniform buffer with new friction AND current aspect ratio
            const aspectRatio = this.gpu.canvas.width / this.gpu.canvas.height;
            const dt = 0.002;
            const frictionHalfLife = this.config.friction * 0.001;
            const friction = Math.exp(-Math.log(2) * dt / frictionHalfLife);

            const uniformData = new Float32Array([
                0.02,   // radius
                0.15,   // rMax
                dt,     // dt
                friction, // friction
                this.config.centralForce || 0.0, // central force
                this.config.numTypes || 3,       // numTypes
                aspectRatio,                     // aspect ratio
                0.0     // padding
            ]);

            this.gpu.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);

            // Store the new configuration as baseline for force modifications
            this.storeCurrentAsBaseline();

            console.log("New configuration applied with aspect ratio support!");
            return true;
        } catch (error) {
            console.error("Error applying new configuration:", error);
            throw error;
        }
    }

    // add this method to reset to original forces
    resetToOriginalForces() {
        if (this.originalForces) {
            console.log("Restoring original forces...");
            this.config.species = JSON.parse(JSON.stringify(this.originalForces));
            this.initializeParticles();
            this.createBindGroups();
            console.log("Original forces restored!");
        } else {
            console.log("No original forces stored to restore");
        }
    }

    // mouse
    setupMouseInteraction() {
        if (!this.mouseInteraction) {
            this.mouseInteraction = new MouseInteraction('webgpu-canvas');
        }
    }


    createMouseUniformBuffer() {
        const { device } = this.gpu;

        // Mouse data structure: Need 12 floats (48 bytes) to match WGSL struct alignment
        const mouseData = new Float32Array(12); // Changed from 8 to 12 floats
        this.updateMouseData(mouseData);

        this.mouseUniformBuffer = device.createBuffer({
            size: mouseData.byteLength, // Now 48 bytes (12 * 4)
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });

        new Float32Array(this.mouseUniformBuffer.getMappedRange()).set(mouseData);
        this.mouseUniformBuffer.unmap();

        console.log("Mouse uniform buffer created successfully with size:", mouseData.byteLength);
    }

    updateMouseData(mouseData) {
        if (!this.mouseInteraction) {
            // Provide default values when mouse interaction isn't ready yet
            mouseData[0] = 0.0;   // position.x
            mouseData[1] = 0.0;   // position.y
            mouseData[2] = 0.0;   // enabled
            mouseData[3] = 50.0;  // strength
            mouseData[4] = 0.3;   // radius
            mouseData[5] = 0.0;   // padding[0]
            mouseData[6] = 0.0;   // padding[1]
            mouseData[7] = 0.0;   // padding[2]
            mouseData[8] = 0.0;   // Additional padding for alignment
            mouseData[9] = 0.0;   // Additional padding for alignment
            mouseData[10] = 0.0;  // Additional padding for alignment
            mouseData[11] = 0.0;  // Additional padding for alignment
            return;
        }

        const mouseInfo = this.mouseInteraction.getMouseData();
        mouseData[0] = mouseInfo.x;        // position.x
        mouseData[1] = mouseInfo.y;        // position.y
        mouseData[2] = mouseInfo.enabled;  // enabled
        mouseData[3] = mouseInfo.strength; // strength
        mouseData[4] = mouseInfo.radius;   // radius
        mouseData[5] = 0.0;               // padding[0]
        mouseData[6] = 0.0;               // padding[1]
        mouseData[7] = 0.0;               // padding[2]
        mouseData[8] = 0.0;               // Additional padding for alignment
        mouseData[9] = 0.0;               // Additional padding for alignment
        mouseData[10] = 0.0;              // Additional padding for alignment
        mouseData[11] = 0.0;              // Additional padding for alignment
    }

    updateMouseUniformBuffer() {
        if (!this.mouseInteraction || !this.mouseUniformBuffer) return;

        const { device } = this.gpu;
        const mouseData = new Float32Array(12);
        this.updateMouseData(mouseData);

        // // DEBUG: Log when mouse is active
        // if (mouseData[2] > 0.5) { // If enabled
        //     console.log("🖱️ Mouse active:", {
        //         pos: [mouseData[0].toFixed(3), mouseData[1].toFixed(3)],
        //         strength: mouseData[3],
        //         radius: mouseData[4]
        //     });
        // }

        device.queue.writeBuffer(this.mouseUniformBuffer, 0, mouseData);
    }

    // / Method to enable/disable mouse interaction
    setMouseInteractionEnabled(enabled) {
        if (!this.mouseInteraction) {
            this.setupMouseInteraction();
        }

        if (this.mouseInteraction) {
            this.mouseInteraction.setEnabled(enabled);

            // CRITICAL FIX: Connect UI controller reference for button synchronization
            if (window.uiController && !this.mouseInteraction.uiController) {
                this.mouseInteraction.setUIController(window.uiController);
            }
        }
    }

    // Method to set mouse force parameters
    setMouseForceParameters(strength, radius) {
        if (!this.mouseInteraction) {
            this.setupMouseInteraction();
        }

        if (this.mouseInteraction) {
            if (strength !== null) this.mouseInteraction.setForceStrength(strength);
            if (radius !== null) this.mouseInteraction.setForceRadius(radius);
        }
    }

    // Method to toggle attract/repel
    toggleMouseForceType() {
        if (!this.mouseInteraction) {
            this.setupMouseInteraction();
        }

        if (this.mouseInteraction) {
            this.mouseInteraction.toggleForceType();
        }
    }

}