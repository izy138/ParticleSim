// STEP 3: Prefix Sum (Scan) - Convert bin counts to bin offsets
// This shader computes cumulative sums to determine where each bin starts in the sorted array
// Each thread independently computes the prefix sum by reading all previous counts

@group(0) @binding(0) var<storage, read_write> binCounts: array<atomic<u32>>;
@group(0) @binding(1) var<storage, read_write> binOffsets: array<u32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let idx = id.x;
    let binCount = arrayLength(&binCounts) - 1u; // -1 because counts[0] is always 0
    
    // binOffsets[0] always stays at 0
    if (idx == 0u) {
        binOffsets[0] = 0u;
        return;
    }
    
    if (idx > binCount) {
        return;
    }
    
    // Compute prefix sum: sum of all counts from index 1 to idx-1
    // This gives us the starting offset for bin (idx-1)
    // Example: if counts[1]=172, counts[2]=147, counts[3]=109
    //   binOffsets[1] = 0 (start of bin 0)
    //   binOffsets[2] = 172 (start of bin 1) 
    //   binOffsets[3] = 319 (start of bin 2)
    //   binOffsets[4] = 428 (start of bin 3)
    
    var sum: u32 = 0u;
    // Sum all counts from index 1 to idx-1
    // We need to compute the prefix sum up to (but not including) idx
    for (var i = 1u; i < idx; i++) {
        let count = atomicLoad(&binCounts[i]);
        sum = sum + count;
    }
    
    // Store the prefix sum (starting offset for bin idx-1)
    // binOffsets[idx] = sum of all counts from 1 to idx-1
    binOffsets[idx] = sum;
}
