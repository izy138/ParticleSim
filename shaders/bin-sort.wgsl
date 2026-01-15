// STEP 4: Sort particles into bins
// This shader sorts particles into the sorted array based on their bin assignments
// Uses atomic operations to get the current index within each bin

@group(0) @binding(0) var<storage, read> particlesIn: array<f32>;
@group(0) @binding(1) var<storage, read_write> binOffsets: array<atomic<u32>>;
@group(0) @binding(2) var<storage, read_write> sortedParticles: array<f32>;

struct BinningParams {
    binSize: f32,
    gridWidth: f32,
    gridHeight: f32,
    padding: f32,
};

@group(0) @binding(3) var<uniform> params: BinningParams;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let idx = id.x;
    let numParticles = arrayLength(&particlesIn) / 5u;
    
    if (idx >= numParticles) {
        return;
    }
    
    // Read particle data
    let baseIdx = idx * 5u;
    let pos = vec2<f32>(particlesIn[baseIdx], particlesIn[baseIdx + 1u]);
    let vel = vec2<f32>(particlesIn[baseIdx + 2u], particlesIn[baseIdx + 3u]);
    let particleType = particlesIn[baseIdx + 4u];
    
    // Calculate which bin this particle belongs to (same logic as count shader)
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
    let maxBinIndex = u32(params.gridWidth * params.gridHeight) - 1u;
    if (binIndex > maxBinIndex) {
        // Out of bounds - skip this particle
        return;
    }
    
    // Get the position in the sorted array using atomic increment
    // binOffsets[binIndex + 1] contains the starting offset for this bin
    // We atomically increment it, and the OLD value (returned) is our position
    // Example: if binOffsets[2] = 170 (start of bin 1)
    //   First particle: atomicAdd returns 170, binOffsets[2] becomes 171
    //   Second particle: atomicAdd returns 171, binOffsets[2] becomes 172
    //   etc.
    let targetOffsetIndex = binIndex + 1u;
    let maxOffsetIndex = u32(params.gridWidth * params.gridHeight); // binCount
    if (targetOffsetIndex > maxOffsetIndex) {
        return;
    }
    
    let sortedIndex = atomicAdd(&binOffsets[targetOffsetIndex], 1u);
    
    // Bounds check: ensure sortedIndex is within valid range
    let maxSortedIndex = arrayLength(&sortedParticles) / 5u;
    if (sortedIndex >= maxSortedIndex) {
        // Out of bounds - skip this particle (shouldn't happen if counts are correct)
        return;
    }
    
    // Write particle to sorted array
    let sortedBaseIdx = sortedIndex * 5u;
    let maxArrayIdx = arrayLength(&sortedParticles);
    if (sortedBaseIdx + 4u < maxArrayIdx) {
        sortedParticles[sortedBaseIdx] = pos.x;
        sortedParticles[sortedBaseIdx + 1u] = pos.y;
        sortedParticles[sortedBaseIdx + 2u] = vel.x;
        sortedParticles[sortedBaseIdx + 3u] = vel.y;
        sortedParticles[sortedBaseIdx + 4u] = particleType;
    } else {
        // Debug: log out of bounds (this shouldn't happen)
        // Can't log in shader, but we can ensure we don't write
    }
}
