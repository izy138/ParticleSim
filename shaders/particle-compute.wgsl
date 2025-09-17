@group(0) @binding(0) var<storage, read> particlesIn: array<f32>;
@group(0) @binding(1) var<storage, read_write> particlesOut: array<f32>;

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

@group(0) @binding(2) var<uniform> params: Params;

@group(0) @binding(3) var<storage, read> attractionMatrix: array<f32>; // Optional legacy
@group(0) @binding(4) var<storage, read> strengthMatrix: array<f32>;
@group(0) @binding(5) var<storage, read> radiusMatrix: array<f32>;
@group(0) @binding(6) var<storage, read> collisionStrengthMatrix: array<f32>;
@group(0) @binding(7) var<storage, read> collisionRadiusMatrix: array<f32>;

// NEW: Mouse interaction uniform buffer
struct MouseData {
    position: vec2<f32>,    // Mouse position in normalized coordinates
    enabled: f32,           // 1.0 if enabled, 0.0 if disabled
    strength: f32,          // Force strength (positive for attract, negative for repel)
    radius: f32,            // Radius of mouse influence
    padding: vec3<f32>,     // Padding for alignment
};

@group(0) @binding(8) var<uniform> mouseData: MouseData;

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
    
    // Original particle-to-particle forces
    for (var j = 0u; j < numParticles; j++) {
        if (j == idx) { continue; }

        let jBase = j * 5u;
        let pos_j = vec2<f32>(particlesIn[jBase], particlesIn[jBase + 1u]);
        let type_j = u32(particlesIn[jBase + 4u]);

        // Apply aspect ratio correction to distance calculation
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
            // Scale force X component back by inverse aspect ratio
            forceContrib.x = forceContrib.x / params.aspectRatio;
            force += forceContrib;
        }
        if (dist < collRadius && collRadius > 0.0) {
            let repulse = collStrength * (1.0 - dist / collRadius);
            var repulseContrib = repulse * dir;
            // Scale repulsion X component back by inverse aspect ratio
            repulseContrib.x = repulseContrib.x / params.aspectRatio;
            force -= repulseContrib;
        }
    }

    // NEW: Mouse interaction force
    if (mouseData.enabled > 0.5) {
        // Calculate distance from particle to mouse with aspect ratio correction
        var mouseDir = mouseData.position - pos;
        mouseDir.x = mouseDir.x * params.aspectRatio;
        
        let mouseDist = length(mouseDir);
        
        if (mouseDist < mouseData.radius && mouseDist > 0.001) {
            // Normalize direction vector
            let mouseNormDir = mouseDir / mouseDist;
            
            // Calculate force strength based on distance (stronger when closer)
            let distanceFactor = 1.0 - (mouseDist / mouseData.radius);
            let mouseForceStrength = mouseData.strength * distanceFactor * distanceFactor; // Quadratic falloff
            
            // Apply mouse force
            var mouseForce = mouseNormDir * mouseForceStrength * 0.05; // changed from 0.001
            
            // Scale force X component back by inverse aspect ratio
            mouseForce.x = mouseForce.x / params.aspectRatio;
            
            force += mouseForce;
        }
    }

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


    // Corner escape force - prevents particles from getting stuck in corners
    // Only activate when particle is very close to BOTH walls (actual corner region)
    let corner_threshold = 0.025; // Distance from walls to consider "in corner"
    
    // Check if particle is in corner region (close to both X and Y walls)
    let in_corner_region = (abs(pos.x) > (1.0 - corner_threshold)) && (abs(pos.y) > (1.0 - corner_threshold));

    if (in_corner_region) {
        var escape_dir = vec2<f32>(0.0, 0.0);
        
        // Determine escape direction based on which corner the particle is in
        if (pos.x > 0.0 && pos.y > 0.0) {
            escape_dir = vec2<f32>(-1.0, -1.0); // Top-right corner
        } else if (pos.x < 0.0 && pos.y > 0.0) {
            escape_dir = vec2<f32>(1.0, -1.0);  // Top-left corner
        } else if (pos.x > 0.0 && pos.y < 0.0) {
            escape_dir = vec2<f32>(-1.0, 1.0);  // Bottom-right corner
        } else {
            escape_dir = vec2<f32>(1.0, 1.0);   // Bottom-left corner
        }
        
        // Count nearby particles to detect clusters
        var nearby_particles = 0u;
        for (var j = 0u; j < numParticles; j++) {
            if (j == idx) { continue; }
            let jBase = j * 5u;
            let pos_j = vec2<f32>(particlesIn[jBase], particlesIn[jBase + 1u]);
            let dist_to_j = length(pos - pos_j);
            if (dist_to_j < 0.1) { // Count particles within 0.1 units
                nearby_particles += 1u;
            }
        }
        
        // Strong repulsion force that increases as particle gets closer to corner
        let distance_from_center = length(pos);
        let base_escape_strength = 7.0 * (distance_from_center - 0.80); // editStronger when farther from center
        
        // Escalate force based on cluster size
        let cluster_multiplier = 1.0 + f32(nearby_particles) * 2.0; // 2x per nearby particle
        let escape_strength = base_escape_strength * cluster_multiplier;
        
        // Limit maximum force to prevent excessive acceleration
        let max_escape_strength = 7.0; // edit this: Cap the maximum force
        let clamped_escape_strength = min(escape_strength, max_escape_strength);
        
        // For large clusters (20+ particles), add opposite direction force
        if (nearby_particles >= 20u) {
            // Apply force in the complete opposite direction (toward center)
            let opposite_dir = normalize(-pos); // Direction toward center
            let opposite_strength = 1.0 * f32(nearby_particles); // Stronger for bigger clusters
            var opposite_force = opposite_dir * opposite_strength;
            
            // Apply aspect ratio correction
            opposite_force.x = opposite_force.x * params.aspectRatio;
            opposite_force.x = opposite_force.x / params.aspectRatio;
            
            force = force + opposite_force;
        }
        
        // Much more reasonable force magnitude
        let base_force_magnitude = 0.99; // edit this
        let escape_force_magnitude = base_force_magnitude * clamped_escape_strength;
        
        // Apply aspect ratio correction
        escape_dir.x = escape_dir.x * params.aspectRatio;
        let escape_dir_len = length(escape_dir);
        if (escape_dir_len > 0.001) {
            escape_dir = escape_dir / escape_dir_len;
        }
        
        var corner_force = escape_dir * escape_force_magnitude;
        corner_force.x = corner_force.x / params.aspectRatio;
        
        // Enhanced velocity damping to prevent excessive acceleration
        // If particle is already moving away from corner, significantly reduce the force
        let velocity_away_from_corner = dot(vel, -corner_force);
        if (velocity_away_from_corner > 0.0) {
            // Particle is already moving away, reduce force more aggressively
            let damping_factor = max(0.05, 1.0 - velocity_away_from_corner * 5.0);
            corner_force = corner_force * damping_factor;
        }
        
        // Additional damping based on current velocity magnitude
        let current_speed = length(vel);
        if (current_speed > 0.5) { // If particle is already moving fast
            let speed_damping = max(11, 1.0 - current_speed * 0.5);
            corner_force = corner_force * speed_damping;
        }
        
        force = force + corner_force;
    }
    
    // Integrate velocity
    var newVel = vel + force * params.dt;
    newVel *= params.friction;

    var newPos = pos + newVel * params.dt;
    
//Apply aspect ratio correction to wall bounds with margin to prevent clipping
    let boundX = 0.997;  // Reduced from 1.0 to prevent edge clipping
    let boundY = 0.994;  // Reduced from 1.0 to prevent edge clipping

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