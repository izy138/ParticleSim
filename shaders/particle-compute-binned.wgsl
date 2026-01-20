// STEP 5: Compute shader with binning optimization
// Uses sorted particles and bin offsets to only check nearby bins (O(n) instead of O(n²))

@group(0) @binding(0) var<storage, read> sortedParticles: array<f32>;
@group(0) @binding(1) var<storage, read_write> particlesOut: array<f32>;
@group(0) @binding(2) var<storage, read> binOffsets: array<u32>;

struct Params {
    radius: f32,
    rMax: f32,
    dt: f32,
    friction: f32,
    centralForce: f32,
    numTypes: f32,
    aspectRatio: f32,
    padding: f32,
};

@group(0) @binding(3) var<uniform> params: Params;

@group(0) @binding(4) var<storage, read> strengthMatrix: array<f32>;
@group(0) @binding(5) var<storage, read> radiusMatrix: array<f32>;
@group(0) @binding(6) var<storage, read> collisionStrengthMatrix: array<f32>;
@group(0) @binding(7) var<storage, read> collisionRadiusMatrix: array<f32>;

// Mouse interaction
struct MouseData {
    position: vec2<f32>,
    enabled: f32,
    strength: f32,
    radius: f32,
    padding: vec3<f32>,
};

@group(0) @binding(8) var<uniform> mouseData: MouseData;

// Binning parameters
struct BinningParams {
    binSize: f32,
    gridWidth: f32,
    gridHeight: f32,
    padding: f32,
};

@group(0) @binding(9) var<uniform> binningParams: BinningParams;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let idx = global_id.x;
    let numParticles = arrayLength(&particlesOut) / 5u;

    if (idx >= numParticles) {
        return;
    }

    // Read particle from sorted array (particles are sorted by bin)
    let baseIdx = idx * 5u;
    let particleType = u32(sortedParticles[baseIdx + 4u]);
    let pos = vec2<f32>(sortedParticles[baseIdx], sortedParticles[baseIdx + 1u]);
    let vel = vec2<f32>(sortedParticles[baseIdx + 2u], sortedParticles[baseIdx + 3u]);

    var force = vec2<f32>(0.0);
    
    // Calculate which bin this particle is in
    let binX = u32(clamp(
        floor((pos.x + 1.0) / binningParams.binSize),
        0.0,
        binningParams.gridWidth - 1.0
    ));
    let binY = u32(clamp(
        floor((pos.y + 1.0) / binningParams.binSize),
        0.0,
        binningParams.gridHeight - 1.0
    ));
    let binIndex = binY * u32(binningParams.gridWidth) + binX;
    
    // Check particles in current bin and 8 adjacent bins (3x3 grid)
    // This reduces complexity from O(n²) to O(n) since each bin has ~constant particles
    for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
            let neighborBinX = i32(binX) + dx;
            let neighborBinY = i32(binY) + dy;
            
            // Bounds check
            if (neighborBinX < 0 || neighborBinX >= i32(binningParams.gridWidth) ||
                neighborBinY < 0 || neighborBinY >= i32(binningParams.gridHeight)) {
                continue;
            }
            
            let neighborBinIndex = u32(neighborBinY) * u32(binningParams.gridWidth) + u32(neighborBinX);
            
            // Get the range of particles in this neighbor bin
            // binOffsets[binIndex + 1] is the start, binOffsets[binIndex + 2] is the end
            let neighborBinStart = binOffsets[neighborBinIndex + 1u];
            var neighborBinEnd: u32;
            if (neighborBinIndex + 1u < u32(binningParams.gridWidth * binningParams.gridHeight)) {
                neighborBinEnd = binOffsets[neighborBinIndex + 2u];
            } else {
                neighborBinEnd = u32(arrayLength(&sortedParticles) / 5u);
            }
            
            // Check all particles in this neighbor bin
            for (var j = neighborBinStart; j < neighborBinEnd; j++) {
                // Skip self (if we're in the same bin and same index)
                if (neighborBinIndex == binIndex && j == idx) {
                    continue;
                }
                
                let jBase = j * 5u;
                let pos_j = vec2<f32>(sortedParticles[jBase], sortedParticles[jBase + 1u]);
                let type_j = u32(sortedParticles[jBase + 4u]);
                
                // Apply aspect ratio correction to distance calculation
                var dx_dist = pos_j.x - pos.x;
                var dy_dist = pos_j.y - pos.y;
                dx_dist = dx_dist * params.aspectRatio;
                
                let dist2 = dx_dist * dx_dist + dy_dist * dy_dist;
                let dist = sqrt(dist2);
                
                // Direction vector (corrected for aspect ratio)
                let dir = vec2<f32>(dx_dist, dy_dist) / max(dist, 1e-5);
                
                let idx_ij = particleType * u32(params.numTypes) + type_j;
                
                let strength = strengthMatrix[idx_ij];
                let radius = radiusMatrix[idx_ij];
                let collStrength = collisionStrengthMatrix[idx_ij];
                let collRadius = collisionRadiusMatrix[idx_ij];
                
                if (dist < radius && radius > 0.0) {
                    let f = strength * (1.0 - dist / radius);
                    var forceContrib = f * dir;
                    forceContrib.x = forceContrib.x / params.aspectRatio;
                    force += forceContrib;
                }
                if (dist < collRadius && collRadius > 0.0) {
                    let repulse = collStrength * (1.0 - dist / collRadius);
                    var repulseContrib = repulse * dir;
                    repulseContrib.x = repulseContrib.x / params.aspectRatio;
                    force -= repulseContrib;
                }
            }
        }
    }

    // Mouse interaction force (same as original)
    if (mouseData.enabled > 0.5) {
        var mouseDir = mouseData.position - pos;
        mouseDir.x = mouseDir.x * params.aspectRatio;
        
        let mouseDist = length(mouseDir);
        
        if (mouseDist < mouseData.radius && mouseDist > 0.001) {
            let mouseNormDir = mouseDir / mouseDist;
            let distanceFactor = 1.0 - (mouseDist / mouseData.radius);
            let mouseForceStrength = mouseData.strength * distanceFactor * distanceFactor;
            var mouseForce = mouseNormDir * mouseForceStrength * 0.05;
            mouseForce.x = mouseForce.x / params.aspectRatio;
            force += mouseForce;
        }
    }

    // Central force (same as original)
    let toCenter = -pos;
    let distanceToCenter = length(vec2<f32>(toCenter.x * params.aspectRatio, toCenter.y));
    
    if (distanceToCenter > 0.001) {
        var centerDirection = toCenter / distanceToCenter;
        centerDirection.x = centerDirection.x * params.aspectRatio;
        let centralForceStrength = params.centralForce * 0.000001;
        var centralForceContrib = centerDirection * centralForceStrength;
        centralForceContrib.x = centralForceContrib.x / params.aspectRatio;
        force += centralForceContrib;
    }

    // Corner escape force (same as original)
    let corner_threshold = 0.025;
    let in_corner_region = (abs(pos.x) > (1.0 - corner_threshold)) && (abs(pos.y) > (1.0 - corner_threshold));

    if (in_corner_region) {
        var escape_dir = vec2<f32>(0.0, 0.0);

        if (pos.x > 0.0 && pos.y > 0.0) {
            escape_dir = vec2<f32>(-1.0, -1.0);
        } else if (pos.x < 0.0 && pos.y > 0.0) {
            escape_dir = vec2<f32>(1.0, -1.0);
        } else if (pos.x > 0.0 && pos.y < 0.0) {
            escape_dir = vec2<f32>(-1.0, 1.0);
        } else {
            escape_dir = vec2<f32>(1.0, 1.0);
        }

        var nearby_particles = 0u;
        // Count nearby particles (simplified - just check current bin)
        let binStart = binOffsets[binIndex + 1u];
        let binEnd = binOffsets[binIndex + 2u];
        for (var j = binStart; j < binEnd; j++) {
            if (j == idx) { continue; }
            let jBase = j * 5u;
            let pos_j = vec2<f32>(sortedParticles[jBase], sortedParticles[jBase + 1u]);
            let dist_to_j = length(pos - pos_j);
            if (dist_to_j < 0.1) {
                nearby_particles += 1u;
            }
        }

        let distance_from_center = length(pos);
        let base_escape_strength = 7.0 * (distance_from_center - 0.80);
        let cluster_multiplier = 1.0 + f32(nearby_particles) * 2.0;
        let escape_strength = base_escape_strength * cluster_multiplier;
        let max_escape_strength = 7.0;
        let clamped_escape_strength = min(escape_strength, max_escape_strength);

        if (nearby_particles >= 20u) {
            let opposite_dir = normalize(-pos);
            let opposite_strength = 1.0 * f32(nearby_particles);
            var opposite_force = opposite_dir * opposite_strength;
            opposite_force.x = opposite_force.x * params.aspectRatio;
            opposite_force.x = opposite_force.x / params.aspectRatio;
            force = force + opposite_force;
        }

        let base_force_magnitude = 0.99;
        let escape_force_magnitude = base_force_magnitude * clamped_escape_strength;

        escape_dir.x = escape_dir.x * params.aspectRatio;
        let escape_dir_len = length(escape_dir);
        if (escape_dir_len > 0.001) {
            escape_dir = escape_dir / escape_dir_len;
        }

        var corner_force = escape_dir * escape_force_magnitude;
        corner_force.x = corner_force.x / params.aspectRatio;

        let velocity_away_from_corner = dot(vel, -corner_force);
        if (velocity_away_from_corner > 0.0) {
            let damping_factor = max(0.05, 1.0 - velocity_away_from_corner * 5.0);
            corner_force = corner_force * damping_factor;
        }

        let current_speed = length(vel);
        if (current_speed > 0.5) {
            let speed_damping = max(11, 1.0 - current_speed * 0.5);
            corner_force = corner_force * speed_damping;
        }

        force = force + corner_force;
    }

    // Integrate velocity
    var newVel = vel + force * params.dt;
    newVel *= params.friction;

    var newPos = pos + newVel * params.dt;

    // Soft bounce from edges - applies velocity damping as particles approach walls
    // This creates a gentle bounce effect that prevents clustering at edges
    let edgeBounceThreshold = 0.05; // Distance from edge where bounce damping starts
    let bounceStrength = .3; // Strength of the bounce damping (lower = softer)
    
    // Calculate distance to each edge
    let distToEdgeX = 1.0 - abs(pos.x);
    let distToEdgeY = 1.0 - abs(pos.y);
    
    // Apply bounce damping to velocity perpendicular to walls
    // As particles approach edges, slow down their velocity toward the wall
    if (distToEdgeX < edgeBounceThreshold && newVel.x != 0.0) {
        // Calculate how close we are to the edge (0.0 = at edge, 1.0 = at threshold)
        let edgeFactor = distToEdgeX / edgeBounceThreshold;
        // Apply damping to velocity component toward the wall
        // If pos.x > 0 and newVel.x > 0, particle moving toward right wall - damp it
        // If pos.x < 0 and newVel.x < 0, particle moving toward left wall - damp it
        if ((pos.x > 0.0 && newVel.x > 0.0) || (pos.x < 0.0 && newVel.x < 0.0)) {
            // Damping factor: stronger when closer to edge
            let dampingFactor = 1.0 - bounceStrength * (1.0 - edgeFactor);
            newVel.x = newVel.x * dampingFactor;
        }
    }
    
    if (distToEdgeY < edgeBounceThreshold && newVel.y != 0.0) {
        let edgeFactor = distToEdgeY / edgeBounceThreshold;
        // Apply damping to velocity component toward the wall
        if ((pos.y > 0.0 && newVel.y > 0.0) || (pos.y < 0.0 && newVel.y < 0.0)) {
            let dampingFactor = 1.0 - bounceStrength * (1.0 - edgeFactor);
            newVel.y = newVel.y * dampingFactor;
        }
    }
    
    // Update position with damped velocity
    newPos = pos + newVel * params.dt;

    // Wall bounds
    let boundX = 0.997;
    let boundY = 0.994;

    if (newPos.x < -boundX) {
        newPos.x = -boundX;
        newVel.x = -newVel.x;
    }
    if (newPos.x > boundX) {
       newPos.x = boundX;
       newVel.x = -newVel.x;
    }
    if (newPos.y < -boundY) {
       newPos.y = -boundY;
       newVel.y = -newVel.y;
    }
    if (newPos.y > boundY) {
        newPos.y = boundY;
        newVel.y = -newVel.y;
    }

    // Write updated state
    particlesOut[baseIdx] = newPos.x;
    particlesOut[baseIdx + 1u] = newPos.y;
    particlesOut[baseIdx + 2u] = newVel.x;
    particlesOut[baseIdx + 3u] = newVel.y;
    particlesOut[baseIdx + 4u] = f32(particleType);
}
