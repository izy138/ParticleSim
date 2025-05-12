// Minimal test version to identify WebGPU issues
class MinimalParticleSimulator {
    constructor(canvasId) {
        this.canvasId = canvasId;
        this.isRunning = false;
    }
    
    async initialize() {
        console.log("Starting minimal WebGPU test...");
        
        try {
            // Initialize WebGPU
            this.gpu = await WebGPUUtils.initialize(this.canvasId);
            if (!this.gpu) {
                console.error("WebGPU initialization failed");
                return false;
            }
            
            const { device } = this.gpu;
            console.log("✓ WebGPU device created");
            
            // Test simple compute shader
            const testComputeShader = `
                @compute @workgroup_size(64)
                fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
                    // This is a no-op compute shader for testing
                }
            `;
            
            const computeModule = device.createShaderModule({
                label: 'test-compute-module',
                code: testComputeShader
            });
            console.log("✓ Compute shader module created");
            
            // Check for compilation errors
            const computeInfo = await computeModule.getCompilationInfo();
            if (computeInfo.messages.length > 0) {
                console.log("Compute shader messages:", computeInfo.messages);
            }
            
            // Create compute pipeline
            const computePipeline = device.createComputePipeline({
                label: 'test-compute-pipeline',
                layout: 'auto',
                compute: {
                    module: computeModule,
                    entryPoint: 'main'
                }
            });
            console.log("✓ Compute pipeline created");
            
            // Test simple render shader
            const testVertexShader = `
                @vertex
                fn main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
                    var pos = vec2<f32>(0.0, 0.0);
                    switch (vertexIndex) {
                        case 0u: { pos = vec2<f32>(-1.0, -1.0); }
                        case 1u: { pos = vec2<f32>(1.0, -1.0); }
                        case 2u: { pos = vec2<f32>(0.0, 1.0); }
                        default: {}
                    }
                    return vec4<f32>(pos, 0.0, 1.0);
                }
            `;
            
            const testFragmentShader = `
                @fragment
                fn main() -> @location(0) vec4<f32> {
                    return vec4<f32>(1.0, 0.0, 0.0, 1.0);
                }
            `;
            
            const renderModule = device.createShaderModule({
                label: 'test-render-module',
                code: testVertexShader + '\n\n' + testFragmentShader
            });
            console.log("✓ Render shader module created");
            
            // Check for compilation errors
            const renderInfo = await renderModule.getCompilationInfo();
            if (renderInfo.messages.length > 0) {
                console.log("Render shader messages:", renderInfo.messages);
            }
            
            // Create render pipeline
            const renderPipeline = device.createRenderPipeline({
                label: 'test-render-pipeline',
                layout: 'auto',
                vertex: {
                    module: renderModule,
                    entryPoint: 'main'
                },
                fragment: {
                    module: renderModule,
                    entryPoint: 'main',
                    targets: [
                        {
                            format: this.gpu.presentationFormat
                        }
                    ]
                },
                primitive: {
                    topology: 'triangle-list'
                }
            });
            console.log("✓ Render pipeline created");
            
            console.log("✓ All basic WebGPU operations successful!");
            return true;
            
        } catch (error) {
            console.error("Error in minimal test:", error);
            WebGPUUtils.showError(`Minimal test failed: ${error.message}`);
            return false;
        }
    }
    
    start() {
        console.log("Minimal test completed successfully!");
    }
}

// Test function
async function runMinimalTest() {
    const testSim = new MinimalParticleSimulator('webgpu-canvas');
    const success = await testSim.initialize();
    if (success) {
        console.log("✓ Your system supports WebGPU and basic operations work!");
        console.log("The issue is likely with the specific particle simulation shaders.");
    } else {
        console.log("✗ Basic WebGPU operations failed. This indicates a fundamental WebGPU issue.");
    }
    return success;
}