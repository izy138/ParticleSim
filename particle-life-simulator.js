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
        // mouse 
        this.mouseInteraction = null;
        this.mouseUniformBuffer = null;
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
            this.setupMouseInteraction(); //mouse
            this.createBindGroups();
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

    // Simulation control methods
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.isPaused = false;
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

            // Update mouse data before rendering
            this.updateMouseUniformBuffer();

            const currentTexture = context.getCurrentTexture();
            const textureView = currentTexture.createView();
            const commandEncoder = device.createCommandEncoder({
                label: 'frame-command-encoder'
            });

            // Only run compute pass if not paused
            if (!this.isPaused) {
                const computePass = commandEncoder.beginComputePass({
                    label: 'compute-pass'
                });

                computePass.setPipeline(this.computePipeline);
                computePass.setBindGroup(0, this.computeBindGroups[this.bufferIndex]);

                const workgroupSize = 64;
                const numWorkgroups = Math.ceil(this.config.numParticles / workgroupSize);
                computePass.dispatchWorkgroups(numWorkgroups);
                computePass.end();

                this.bufferIndex = 1 - this.bufferIndex;
            }

            // Always render
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

            device.queue.submit([commandEncoder.finish()]);
        } catch (error) {
            console.error("Error in render:", error);
            this.stop();
            WebGPUUtils.showError(`Rendering error: ${error.message}`);
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