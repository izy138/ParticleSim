// Simplified render shader for particle life simulator

// Vertex shader output
struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec4<f32>,
    @location(1) particlePos: vec2<f32>,
    @location(2) quadPos: vec2<f32>,
}

// Particle buffer (x, y, vx, vy, type)
@group(0) @binding(0) var<storage, read> particles: array<f32>;

// Color buffer
@group(0) @binding(1) var<storage, read> colors: array<vec4<f32>>;

// Vertex shader
@vertex
fn vertexMain(
    @builtin(vertex_index) vertexIndex: u32,
    @builtin(instance_index) instanceIndex: u32
) -> VertexOutput {
    // Each particle is drawn as a quad (2 triangles, 6 vertices)
    let particleIndex = instanceIndex;
    let vertexInQuad = vertexIndex % 6u;
    
    // Get particle data
    let baseIdx = particleIndex * 5u;
    let particleType = u32(particles[baseIdx + 4u]);
    let particlePos = vec2<f32>(particles[baseIdx], particles[baseIdx + 1u]);
    
    // Particle size
    let particleSize = 0.01;
    
    // Define quad corners
    var quadPos: vec2<f32>;
    switch (vertexInQuad) {
        case 0u: { quadPos = vec2<f32>(-1.0, -1.0); } // Bottom-left
        case 1u: { quadPos = vec2<f32>(1.0, -1.0); }  // Bottom-right
        case 2u: { quadPos = vec2<f32>(-1.0, 1.0); }  // Top-left
        case 3u: { quadPos = vec2<f32>(1.0, -1.0); }  // Bottom-right
        case 4u: { quadPos = vec2<f32>(1.0, 1.0); }   // Top-right
        case 5u: { quadPos = vec2<f32>(-1.0, 1.0); }  // Top-left
        default: { quadPos = vec2<f32>(0.0, 0.0); }   // Should never happen
    }
    
    // Calculate final vertex position
    let worldPos = particlePos + quadPos * particleSize;
    
    // Get color for particle type
    let color = colors[particleType];
    
    var output: VertexOutput;
    output.position = vec4<f32>(worldPos, 0.0, 1.0);
    output.color = color;
    output.particlePos = particlePos;
    output.quadPos = quadPos;
    
    return output;
}

// Fragment shader
@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
    // Calculate distance from center of quad
    let distFromCenter = length(input.quadPos);
    
    // Create circular particles with smooth edges
    var alpha = 1.0 - smoothstep(0.8, 1.0, distFromCenter);
    
    // Apply color with calculated alpha
    var color = input.color;
    color.a *= alpha;
    
    return color;
}