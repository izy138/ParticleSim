// STEP 2: Count particles per bin
// This shader counts how many particles are in each spatial bin

@group(0) @binding(0) var<storage, read> particles: array<f32>;
@group(0) @binding(1) var<storage, read_write> binCounts: array<atomic<u32>>;

struct BinningParams {
    binSize: f32,
    gridWidth: f32,
    gridHeight: f32,
    padding: f32,
};

@group(0) @binding(2) var<uniform> params: BinningParams;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let idx = id.x;
    let numParticles = arrayLength(&particles) / 5u;
    
    if (idx >= numParticles) {
        return;
    }
    
    // Read particle position (normalized coordinates [-1, 1])
    let baseIdx = idx * 5u;
    let pos = vec2<f32>(particles[baseIdx], particles[baseIdx + 1u]);
    
    // Calculate which bin this particle belongs to
    // Convert from [-1, 1] to [0, 2], then divide by bin size
    let binX = u32(clamp(
        floor((pos.x + 1.0) / params.binSize),
        0.0,
        params.gridWidth - 1.0
    ));
    let binY = u32(clamp(
        floor((pos.y + 1.0) / params.binSize),
        0.0,
        params.gridHeight - 1.0
    ));
    
    // Linearized bin index
    let binIndex = binY * u32(params.gridWidth) + binX;
    
    // Bounds check: ensure binIndex is within valid range
    // binIndex should be 0 to (gridWidth * gridHeight - 1)
    let maxBinIndex = u32(params.gridWidth * params.gridHeight) - 1u;
    if (binIndex > maxBinIndex) {
        // Out of bounds - this shouldn't happen, but guard against it
        return;
    }
    
    // Increment the count for this bin atomically
    // We store counts at index binIndex + 1, leaving index 0 at 0
    // This makes prefix sum easier later
    // Ensure we don't exceed buffer bounds (buffer has binCount + 1 elements, indices 0 to binCount)
    let targetIndex = binIndex + 1u;
    let maxBufferIndex = u32(params.gridWidth * params.gridHeight); // binCount
    if (targetIndex <= maxBufferIndex) {
        atomicAdd(&binCounts[targetIndex], 1u);
    }
}
