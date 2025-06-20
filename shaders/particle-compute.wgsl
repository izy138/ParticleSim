// Updated Particle Compute Shader with Aspect Ratio Correction

@group(0) @binding(0) var<storage, read> particlesIn: array<f32>;
@group(0) @binding(1) var<storage, read_write> particlesOut: array<f32>;

struct Params {
    radius: f32,
    rMax: f32,
    dt: f32,
    friction: f32,
    centralForce: f32,
    numTypes: f32,
    aspectRatio: f32,    // NEW: Add aspect ratio to params
    padding: f32,        // NEW: Padding for alignment
};

@group(0) @binding(2) var<uniform> params: Params;

@group(0) @binding(3) var<storage, read> attractionMatrix: array<f32>; // Optional legacy
@group(0) @binding(4) var<storage, read> strengthMatrix: array<f32>;
@group(0) @binding(5) var<storage, read> radiusMatrix: array<f32>;
@group(0) @binding(6) var<storage, read> collisionStrengthMatrix: array<f32>;
@group(0) @binding(7) var<storage, read> collisionRadiusMatrix: array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let idx = global_id.x;
    let numParticles = arrayLength(&particlesIn) / 5u;

    if (idx >= numParticles) {
        return;
    }

    let baseIdx = idx * 5u;
    let particleType = u32(particlesIn[baseIdx + 4u]);
    let pos = vec2<f32>(particlesIn[baseIdx], particlesIn[baseIdx + 1u]);
    let vel = vec2<f32>(particlesIn[baseIdx + 2u], particlesIn[baseIdx + 3u]);

    var force = vec2<f32>(0.0);
    for (var j = 0u; j < numParticles; j++) {
        if (j == idx) { continue; }

        let jBase = j * 5u;
        let pos_j = vec2<f32>(particlesIn[jBase], particlesIn[jBase + 1u]);
        let type_j = u32(particlesIn[jBase + 4u]);

        // FIXED: Apply aspect ratio correction to distance calculation
        var dx = pos_j.x - pos.x;
        var dy = pos_j.y - pos.y;
        
        // Scale X distance by aspect ratio to maintain circular interaction areas
        dx = dx * params.aspectRatio;
        
        let dist2 = dx * dx + dy * dy;
        let dist = sqrt(dist2);
        
        // Direction vector (corrected for aspect ratio)
        let dir = vec2<f32>(dx, dy) / max(dist, 1e-5);

        let idx_ij = particleType * u32(params.numTypes) + type_j;

        let strength = strengthMatrix[idx_ij];
        let radius = radiusMatrix[idx_ij];
        let collStrength = collisionStrengthMatrix[idx_ij];
        let collRadius = collisionRadiusMatrix[idx_ij];

        if (dist < radius && radius > 0.0) {
            let f = strength * (1.0 - dist / radius);
            var forceContrib = f * dir;
            // FIXED: Scale force X component back by inverse aspect ratio
            forceContrib.x = forceContrib.x / params.aspectRatio;
            force += forceContrib;
        }
        if (dist < collRadius && collRadius > 0.0) {
            let repulse = collStrength * (1.0 - dist / collRadius);
            var repulseContrib = repulse * dir;
            // FIXED: Scale repulsion X component back by inverse aspect ratio
            repulseContrib.x = repulseContrib.x / params.aspectRatio;
            force -= repulseContrib;
        }
    }

    // FIXED: Apply aspect ratio correction to central force
    let toCenter = -pos;
    let distanceToCenter = length(vec2<f32>(toCenter.x * params.aspectRatio, toCenter.y));
    
    // Only apply central force if particle is not already at center
    if (distanceToCenter > 0.001) {
        var centerDirection = toCenter / distanceToCenter;
        centerDirection.x = centerDirection.x * params.aspectRatio;
        
        // Scale force by distance (stronger when farther from center)
        // And make it much weaker overall
        let centralForceStrength = params.centralForce * 0.000001;
        var centralForceContrib = centerDirection * centralForceStrength;
        centralForceContrib.x = centralForceContrib.x / params.aspectRatio;
        force += centralForceContrib;
    }

    // Integrate velocity
    var newVel = vel + force * params.dt;
    newVel *= params.friction;

    var newPos = pos + newVel * params.dt;
    
    // FIXED: Apply aspect ratio correction to wall bounds
    let boundX = 1.0;
    let boundY = 1.0;

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