class ParticleLifeSimulator {
    constructor(canvasId, config) {
        this.canvasId = canvasId;

        // Debug: Add frame counter
        this.frameCount = 0;
        this.debugInterval = 60; // Log every 60 frames

        // Load configuration from particle-life-system.json by default
        this.config = Object.assign({
            numParticles: 1000,
            numTypes: 3,
            particleSize: 0.015,  // NEW: Base particle size (relative to world space)
            particleOpacity: 0.8  // NEW: Particle opacity (0-1)
        }, config);

        this.isRunning = false;
        this.frameId = null;
        this.bufferIndex = 0;
    }

    async initialize() {
        try {
            console.log("Starting WebGPU initialization...");

            // Initialize WebGPU
            this.gpu = await WebGPUUtils.initialize(this.canvasId);
            if (!this.gpu) return false;

            const { device } = this.gpu;
            console.log("WebGPU device initialized");

            // Load configuration from particle-life-system.json if it exists
            await this.loadConfiguration();
            console.log("Configuration loaded:", {
                numParticles: this.config.numParticles,
                numTypes: this.config.numTypes,
                particleSize: this.config.particleSize,
                particleOpacity: this.config.particleOpacity
            });

            // Load shaders with proper paths
            console.log("Loading shaders...");
            const computeShaderCode = await WebGPUUtils.loadShader('shaders/particle-compute.wgsl');
            const renderShaderCode = await WebGPUUtils.loadShader('shaders/particle-render.wgsl');
            console.log("Shaders loaded successfully");
            console.log("Compute shader length:", computeShaderCode.length);
            console.log("Render shader length:", renderShaderCode.length);

            // Initialize particles
            console.log("Initializing particles...");
            this.initializeParticles();

            // Create shader modules
            console.log("Creating shader modules...");
            this.createShaderModules(computeShaderCode, renderShaderCode);

            // Create bind groups and pipelines
            console.log("Creating bind groups...");
            this.createBindGroups();

            console.log("Creating pipelines...");
            this.createPipelines();

            console.log("Initialization complete!");
            return true;
        } catch (error) {
            console.error("Initialization error:", error);
            WebGPUUtils.showError(`Simulator initialization failed: ${error.message}`);
            return false;
        }
    }

    async loadConfiguration() {
        try {
            // Try to load particle-life-system.json
            const response = await fetch('particle-life-system.json');
            if (!response.ok) {
                console.log("No particle-life-system.json found, using default configuration");
                return;
            }

            const config = await response.json();

            // Override configuration with loaded values
            this.config.numParticles = config.particleCount;
            this.config.numTypes = config.species.length;
            this.config.simulationSize = config.simulationSize;
            this.config.friction = parseFloat(config.friction) || 10.0;
            this.config.centralForce = config.centralForce || 0;
            this.config.symmetricForces = config.symmetricForces || false;
            this.config.species = config.species;

            // NEW: Load particle size and opacity if present
            if (config.particleSize !== undefined) {
                this.config.particleSize = config.particleSize;
            }
            if (config.particleOpacity !== undefined) {
                this.config.particleOpacity = config.particleOpacity;
            }

            // Extract colors and force matrices from species
            this.config.colors = config.species.map(species => species.color);
            this.config.attractionMatrix = this.extractAttractionMatrix(config.species);

            console.log("Loaded configuration from particle-life-system.json");
            console.log("Attraction matrix sample:", this.config.attractionMatrix[0]);
        } catch (error) {
            console.warn("Could not load particle-life-system.json:", error.message);
        }
    }

    extractAttractionMatrix(species) {
        const numTypes = species.length;
        const matrix = [];

        // Extract first force values and normalize them
        for (let i = 0; i < numTypes; i++) {
            const row = [];
            for (let j = 0; j < numTypes; j++) {
                if (species[i].forces && species[i].forces[j]) {
                    // Normalize strength to a reasonable range (-1 to 1)
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

            // Convert HSL to RGB
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
        const { numParticles, numTypes, simulationSize = [800, 600] } = this.config;

        console.log(`Initializing ${numParticles} particles with ${numTypes} types`);

        // Create particle data: x, y, vx, vy, type
        const particleData = new Float32Array(numParticles * 5);

        for (let i = 0; i < numParticles; i++) {
            const baseIndex = i * 5;
            // Random position in normalized device coordinates [-1, 1]
            particleData[baseIndex] = Math.random() * 2 - 1;     // x
            particleData[baseIndex + 1] = Math.random() * 2 - 1; // y
            // Larger initial velocities for debugging
            particleData[baseIndex + 2] = (Math.random() - 0.5) * 0.1; // vx
            particleData[baseIndex + 3] = (Math.random() - 0.5) * 0.1; // vy
            particleData[baseIndex + 4] = Math.floor(Math.random() * numTypes);
        }

        // DEBUG: Log first few particles
        console.log("First particle:", {
            x: particleData[0],
            y: particleData[1],
            vx: particleData[2],
            vy: particleData[3],
            type: particleData[4]
        });

        // Create particle buffers (double buffering)
        // FIXED: Add CopySrc usage for debugging
        const bufferSize = particleData.byteLength;
        console.log(`Creating particle buffers of size: ${bufferSize} bytes`);

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

        // Map data to both buffers
        new Float32Array(this.particleBuffers[0].getMappedRange()).set(particleData);
        this.particleBuffers[0].unmap();

        new Float32Array(this.particleBuffers[1].getMappedRange()).set(particleData);
        this.particleBuffers[1].unmap();

        // Create uniform buffer for simulation parameters
        // Use the proper dt value from config
        const frictionHalfLife = this.config.friction * 0.001; // Convert to seconds
        const dt = 0.001; // This is the time step
        const friction = Math.exp(-Math.log(2) * dt / frictionHalfLife);

        const uniformData = new Float32Array([
            0.02,   // radius (particle radius)
            0.15,   // rMax (maximum interaction radius)
            dt,     // dt (time step)
            friction, // friction coefficient
            this.config.centralForce || 0.0, // central force
            this.config.numTypes || 3        // numTypes as uint (will cast in shader)
        ]);

        console.log("Uniform data:", uniformData);
        console.log("Friction half-life:", frictionHalfLife);
        console.log("Calculated friction:", friction);

        this.uniformBuffer = device.createBuffer({
            size: uniformData.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Float32Array(this.uniformBuffer.getMappedRange()).set(uniformData);
        this.uniformBuffer.unmap();        

        // Create attraction matrix buffer
        if (!this.config.attractionMatrix) {
            this.config.attractionMatrix = this.generateRandomAttractionMatrix();
        }

        // === NEW: Build additional force matrices ===
        // const { numTypes } = this.config;
        const species = this.config.species;
        const strengthMatrix = [];
        const radiusMatrix = [];
        const collisionStrengthMatrix = [];
        const collisionRadiusMatrix = [];

        for (let i = 0; i < numTypes; i++) {
            for (let j = 0; j < numTypes; j++) {
                const force = species[i].forces?.[j];

                strengthMatrix.push(force ? force.strength / 200.0 : 100); //0
                radiusMatrix.push(force ? force.radius / 130.0 : 50.0); //:30.0 //0.05
                collisionStrengthMatrix.push(force ? force.collisionStrength / 30.0 : 10); //0
                collisionRadiusMatrix.push(force ? force.collisionRadius /275.0 : 18); //:5.0 //0.02
            }
        }

        // Store for later updates (like sliders)
        this.config.strengthMatrix = strengthMatrix;
        this.config.radiusMatrix = radiusMatrix;
        this.config.collisionStrengthMatrix = collisionStrengthMatrix;
        this.config.collisionRadiusMatrix = collisionRadiusMatrix;

        // === Upload to GPU buffers ===
        this.strengthBuffer = WebGPUUtils.createBuffer(device, new Float32Array(strengthMatrix), GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
        this.radiusBuffer = WebGPUUtils.createBuffer(device, new Float32Array(radiusMatrix), GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
        this.collisionStrengthBuffer = WebGPUUtils.createBuffer(device, new Float32Array(collisionStrengthMatrix), GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
        this.collisionRadiusBuffer = WebGPUUtils.createBuffer(device, new Float32Array(collisionRadiusMatrix), GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);

        const matrixData = new Float32Array(numTypes * numTypes);
        for (let i = 0; i < numTypes; i++) {
            for (let j = 0; j < numTypes; j++) {
                matrixData[i * numTypes + j] = this.config.attractionMatrix[i][j];
            }
        }

        console.log("Attraction matrix data (first 10):", Array.from(matrixData.slice(0, 10)));

        this.matrixBuffer = device.createBuffer({
            size: matrixData.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Float32Array(this.matrixBuffer.getMappedRange()).set(matrixData);
        this.matrixBuffer.unmap();

        // Create color buffer
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

        // NEW: Create render uniform buffer for particle size and opacity
        this.createRenderUniformBuffer();

        console.log("Particle buffers created successfully");
    }

    // NEW: Create render uniform buffer
    createRenderUniformBuffer() {
        const { device, canvas } = this.gpu;
        
        // Calculate aspect ratio to maintain circular particles
        const aspectRatio = canvas.width / canvas.height;
        
        const renderUniformData = new Float32Array([
            this.config.particleSize,     // Base particle size
            this.config.particleOpacity,  // Particle opacity
            aspectRatio,                  // Aspect ratio
            0.0                          // Padding
        ]);

        this.renderUniformBuffer = device.createBuffer({
            size: renderUniformData.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Float32Array(this.renderUniformBuffer.getMappedRange()).set(renderUniformData);
        this.renderUniformBuffer.unmap();
    }

    // NEW: Method to update particle size and opacity
    updateParticleAppearance(size, opacity) {
        const { device, canvas } = this.gpu;
        
        this.config.particleSize = size;
        this.config.particleOpacity = opacity;
        
        // Calculate aspect ratio
        const aspectRatio = canvas.width / canvas.height;
        
        const renderUniformData = new Float32Array([
            this.config.particleSize,
            this.config.particleOpacity,
            aspectRatio,
            0.0
        ]);

        device.queue.writeBuffer(this.renderUniformBuffer, 0, renderUniformData);
    }

    createShaderModules(computeShaderCode, renderShaderCode) {
        const { device } = this.gpu;

        try {
            // Create compute shader module
            this.computeModule = device.createShaderModule({
                label: 'compute-module',
                code: computeShaderCode
            });
            console.log("Compute shader module created");

            // Create render shader module
            this.renderModule = device.createShaderModule({
                label: 'render-module',
                code: renderShaderCode
            });
            console.log("Render shader module created");

            // Check compilation info
            this.computeModule.getCompilationInfo().then(info => {
                if (info.messages.length > 0) {
                    console.log("Compute shader compilation messages:", info.messages);
                } else {
                    console.log("Compute shader compiled without warnings");
                }
            });

            this.renderModule.getCompilationInfo().then(info => {
                if (info.messages.length > 0) {
                    console.log("Render shader compilation messages:", info.messages);
                } else {
                    console.log("Render shader compiled without warnings");
                }
            });
        } catch (error) {
            console.error("Error creating shader modules:", error);
            throw error;
        }
    }

    createBindGroups() {
        const { device } = this.gpu;

        try {
            // Create bind group layout for compute
            this.computeBindGroupLayout = device.createBindGroupLayout({
                label: 'compute-bind-group-layout',
                entries: [
                            // Particle buffers
                    {
                        binding: 0,
                        visibility: GPUShaderStage.COMPUTE,
                        buffer: { type: 'read-only-storage' }
                    },
                    {
                        binding: 1,
                        visibility: GPUShaderStage.COMPUTE,
                        buffer: { type: 'storage' }
                    },
                            // Simulation parameters
                    {
                        binding: 2,
                        visibility: GPUShaderStage.COMPUTE,
                        buffer: { type: 'uniform' }
                    },
                            // Base attraction matrix
                    {
                        binding: 3,
                        visibility: GPUShaderStage.COMPUTE,
                        buffer: { type: 'read-only-storage' }
                    },
                    {
                             // Extended force parameters
                        binding: 4,
                        visibility: GPUShaderStage.COMPUTE,
                        buffer: { type: 'read-only-storage' }
                    },
                    {
                        binding: 5,
                        visibility: GPUShaderStage.COMPUTE,
                        buffer: { type: 'read-only-storage' }
                    },
                    {
                        binding: 6,
                        visibility: GPUShaderStage.COMPUTE,
                        buffer: { type: 'read-only-storage' }
                    },
                    {
                        binding: 7,
                        visibility: GPUShaderStage.COMPUTE,
                        buffer: { type: 'read-only-storage' }
                    }

                ]
            });

            // Create compute bind groups
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
                        { binding: 7, resource: { buffer: this.collisionRadiusBuffer } }


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
                        { binding: 7, resource: { buffer: this.collisionRadiusBuffer } }

                    ]
                })
            ];

            // Create bind group layout for rendering - UPDATED to include render uniform
            this.renderBindGroupLayout = device.createBindGroupLayout({
                label: 'render-bind-group-layout',
                entries: [
                    {
                        binding: 0,
                        visibility: GPUShaderStage.VERTEX,
                        buffer: { type: 'read-only-storage' }
                    },
                    {
                        binding: 1,
                        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                        buffer: { type: 'read-only-storage' }
                    },
                    // NEW: Render uniform buffer
                    {
                        binding: 2,
                        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                        buffer: { type: 'uniform' }
                    }
                ]
            });

            // Create render bind groups - UPDATED to include render uniform
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

            console.log("Bind groups created successfully");
        } catch (error) {
            console.error("Error creating bind groups:", error);
            throw error;
        }
    }

    createPipelines() {
        const { device, presentationFormat } = this.gpu;

        try {
            // Create compute pipeline layout
            const computePipelineLayout = device.createPipelineLayout({
                label: 'compute-pipeline-layout',
                bindGroupLayouts: [this.computeBindGroupLayout]
            });

            // Create compute pipeline
            console.log("Creating compute pipeline...");
            this.computePipeline = device.createComputePipeline({
                label: 'compute-pipeline',
                layout: computePipelineLayout,
                compute: {
                    module: this.computeModule,
                    entryPoint: 'main'
                }
            });
            console.log("Compute pipeline created successfully");

            // Create render pipeline layout
            const renderPipelineLayout = device.createPipelineLayout({
                label: 'render-pipeline-layout',
                bindGroupLayouts: [this.renderBindGroupLayout]
            });

            // Create render pipeline
            console.log("Creating render pipeline...");
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
                    targets: [
                        {
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
                        }
                    ]
                },
                primitive: {
                    topology: 'triangle-list'
                }
            });
            console.log("Render pipeline created successfully");
        } catch (error) {
            console.error("Error creating pipelines:", error);
            throw error;
        }
    }

    start() {
        if (this.isRunning) return;

        console.log("Starting simulation...");
        this.isRunning = true;
        console.log("Starting with buffer index:", this.bufferIndex);
        this.frameId = requestAnimationFrame(this.update.bind(this));
    }

    stop() {
        if (!this.isRunning) return;

        console.log("Stopping simulation...");
        this.isRunning = false;
        if (this.frameId) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }
    }

    reset() {
        console.log("Resetting simulation...");
        this.stop();
        this.bufferIndex = 0; // Reset buffer index on explicit reset
        this.initializeParticles();
        this.createBindGroups();
        this.start();
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
            // Increment frame counter first
            this.frameCount++;

            // DEBUG: Log frame info periodically
            if (this.frameCount === 1 || this.frameCount % this.debugInterval === 0) {
                console.log(`Frame ${this.frameCount} - Starting with buffer index: ${this.bufferIndex}`);
            }

            // CRITICAL FIX: Get fresh texture each frame
            // This prevents the device association errors
            const currentTexture = context.getCurrentTexture();
            const textureView = currentTexture.createView();

            // Create command encoder for this frame
            const commandEncoder = device.createCommandEncoder({
                label: 'frame-command-encoder'
            });

            // Compute pass - process particles
            const computePass = commandEncoder.beginComputePass({
                label: 'compute-pass'
            });

            computePass.setPipeline(this.computePipeline);
            // Read from current buffer, write to the other buffer
            computePass.setBindGroup(0, this.computeBindGroups[this.bufferIndex]);

            // Dispatch compute shader
            const workgroupSize = 64;
            const numWorkgroups = Math.ceil(this.config.numParticles / workgroupSize);

            // DEBUG: Log workgroup info periodically
            if (this.frameCount === 1 || this.frameCount % this.debugInterval === 0) {
                console.log(`Using compute bind group ${this.bufferIndex} (read from buffer ${this.bufferIndex}, write to buffer ${1 - this.bufferIndex})`);
                console.log(`Dispatching ${numWorkgroups} workgroups for ${this.config.numParticles} particles`);
            }

            computePass.dispatchWorkgroups(numWorkgroups);
            computePass.end();

            // IMPORTANT: Flip buffer index AFTER compute pass completes
            this.bufferIndex = 1 - this.bufferIndex;

            // Render pass - draw particles
            const renderPass = commandEncoder.beginRenderPass({
                label: 'render-pass',
                colorAttachments: [
                    {
                        view: textureView,
                        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                        loadOp: 'clear',
                        storeOp: 'store'
                    }
                ]
            });

            renderPass.setPipeline(this.renderPipeline);
            // Render from the buffer that was just updated
            renderPass.setBindGroup(0, this.renderBindGroups[this.bufferIndex]);

            // Draw particles using instancing
            renderPass.draw(6, this.config.numParticles);
            renderPass.end();

            // Submit commands
            device.queue.submit([commandEncoder.finish()]);

            // DEBUG: Log buffer state after operations
            if (this.frameCount === 1 || this.frameCount % this.debugInterval === 0) {
                console.log(`After flip - Now rendering from buffer index: ${this.bufferIndex}`);
                console.log("---");
            }
        } catch (error) {
            console.error("Error in render:", error);
            // Stop the simulation on error to prevent error spam
            this.stop();
            WebGPUUtils.showError(`Rendering error: ${error.message}`);
        }
    }
}