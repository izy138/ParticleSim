// config-generator.js - Complete implementation

class ConfigGenerator {
    constructor() {
        this.forceParams = {
            strengthModifier: 110,
            radiusRange: 25,
            collisionStrengthRange: 750,
            collisionRadiusRange: 4
        };
    }

    generateColors(numTypes) {
        const colors = [];
        
        // Start with a random base hue for variety between simulations
        const baseHue = Math.random() * 360;
        
        // Use color harmony schemes based on number of types
        // This creates cohesive, vibrant palettes that work well together
        let hueScheme = [];
        
        if (numTypes === 2) {
            // Complementary colors (opposites on color wheel)
            hueScheme = [baseHue, (baseHue + 180) % 360];
        } else if (numTypes === 3) {
            // Triadic colors (120 degrees apart)
            hueScheme = [baseHue, (baseHue + 120) % 360, (baseHue + 240) % 360];
        } else if (numTypes === 4) {
            // Tetradic colors (90 degrees apart)
            hueScheme = [baseHue, (baseHue + 90) % 360, (baseHue + 180) % 360, (baseHue + 270) % 360];
        } else if (numTypes === 5) {
            // Pentadic colors (72 degrees apart) with slight variations for harmony
            hueScheme = [
                baseHue,
                (baseHue + 72) % 360,
                (baseHue + 144) % 360,
                (baseHue + 216) % 360,
                (baseHue + 288) % 360
            ];
        } else if (numTypes === 6) {
            // Hexadic colors (60 degrees apart)
            hueScheme = [
                baseHue,
                (baseHue + 60) % 360,
                (baseHue + 120) % 360,
                (baseHue + 180) % 360,
                (baseHue + 240) % 360,
                (baseHue + 300) % 360
            ];
        } else {
            // For 7+ types, use evenly distributed hues with slight variations
            for (let i = 0; i < numTypes; i++) {
                const evenHue = (baseHue + (i * 360 / numTypes)) % 360;
                // Add small variation (±10 degrees) for more natural look
                const variation = (Math.random() - 0.5) * 20;
                hueScheme.push((evenHue + variation + 360) % 360);
            }
        }
        
        // Generate colors with high saturation and varied lightness for depth
        for (let i = 0; i < numTypes; i++) {
            const hue = hueScheme[i];
            
            // Very high saturation (0.8-1.0) for vibrant, popping colors
            // Similar to the particle-life JSON which has high saturation
            const saturation = 0.8 + Math.random() * 0.2;
            
            // Varied lightness (0.35-0.75) for visual interest and contrast
            // Create a mix of lighter and darker colors for depth
            // Distribute lightness more strategically for better contrast
            let lightness;
            if (numTypes <= 4) {
                // For fewer types, ensure good contrast
                lightness = 0.4 + (i % 2) * 0.2 + Math.random() * 0.15;
            } else {
                // For more types, distribute lightness more evenly
                lightness = 0.35 + (i / numTypes) * 0.3 + Math.random() * 0.1;
            }
            lightness = Math.max(0.3, Math.min(0.8, lightness)); // Clamp between 0.3 and 0.8
            
            // Convert HSL to RGB
            const [r, g, b] = this.hslToRgb(hue, saturation, lightness);
            colors.push([r, g, b]);
        }
        
        // Shuffle colors slightly to avoid predictable patterns
        // This adds variety while maintaining harmony
        for (let i = colors.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [colors[i], colors[j]] = [colors[j], colors[i]];
        }
        
        return colors;
    }

    hslToRgb(h, s, l) {
        // Convert HSL to RGB
        // h: 0-360, s: 0-1, l: 0-1
        h /= 360;
        const a = s * Math.min(l, 1 - l);
        const f = (n, k = (n + h * 12) % 12) => {
            return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        };
        return [f(0), f(8), f(4)];
    }

    calculateForce(typeA, typeB, numTypes, forceScale, radius) {
        // existing lava lamp formula
        const seed1 = (typeA * 7 + typeB * 13 + numTypes * 3) % 1000;
        const seed2 = (typeA * 11 + typeB * 17 + numTypes * 5) % 1000;
        const random1 = (seed1 * 9301 + 49297) % 233280 / 233280.0;
        const random2 = (seed2 * 4171 + 7919) % 233280 / 233280.0;
        const random3 = (seed1 * 1231 + seed2 * 3571) % 233280 / 233280.0;
        const random4 = (seed2 * 8191 + seed1 * 1597) % 233280 / 233280.0;

        let strength, interactionRadius, collisionStrength, collisionRadius;

        if (typeA === typeB) {
            if (typeA === Math.floor(numTypes * 0.6)) {
                strength = -(40 + random1 * 40) * forceScale;
                interactionRadius = 3 + random2 * 8;
            } else {
                strength = (30 + random1 * 65) * forceScale;
                interactionRadius = 12 + random2 * 18;
            }
        } else {
            const asymmetricSeed = (typeA * 23 + typeB * 41) % 1000;
            const asymmetricRandom = (asymmetricSeed * 6121 + 3571) % 233280 / 233280.0;

            if (asymmetricRandom < 0.52) {
                strength = (25 + random1 * 75) * forceScale;
            } else {
                strength = -(20 + random1 * 80) * forceScale;
            }

            const radiusType = random2;
            if (radiusType < 0.15) {
                interactionRadius = 2.5 + random3 * 5;
            } else if (radiusType < 0.85) {
                interactionRadius = 8 + random3 * 22;
            } else {
                interactionRadius = 28 + random3 * 4;
            }
        }

        const baseCollisionStrength = Math.abs(strength) * (15 + random4 * 10);
        collisionStrength = Math.max(200, baseCollisionStrength + random4 * 800);
        const collisionRatio = 0.15 + random1 * 0.2;
        collisionRadius = Math.max(0.4, interactionRadius * collisionRatio);

        return {
            strength: strength,
            radius: interactionRadius * (radius / 20),
            collisionStrength: collisionStrength,
            collisionRadius: collisionRadius
        };
    }

    generateImbalancedPopulations(numTypes) {
        const weights = [];

        if (numTypes === 3) {
            weights.push(0.45, 0.35, 0.20);
        } else if (numTypes === 4) {
            weights.push(0.35, 0.30, 0.25, 0.10);
        } else if (numTypes === 5) {
            weights.push(0.25, 0.28, 0.22, 0.15, 0.10);
        } else if (numTypes === 6) {
            weights.push(0.25, 0.23, 0.18, 0.16, 0.12, 0.06);
        } else if (numTypes === 7) {
            weights.push(0.22, 0.20, 0.18, 0.15, 0.12, 0.08, 0.05);
        } else if (numTypes === 8) {
            weights.push(0.20, 0.18, 0.16, 0.14, 0.12, 0.10, 0.07, 0.03);
        } else {
            for (let i = 0; i < numTypes; i++) {
                weights.push(0.4 / (i + 1));
            }
        }

        const sum = weights.reduce((a, b) => a + b);
        return weights.map(w => w / sum);
    }
    generateLavaLampConfiguration(numTypes = 5, numParticles = 12000, forceScale = 1, radius = 20, friction = 50, particleSize = 0.007, particleOpacity = 0.75) {
        const colors = this.generateColors(numTypes);
        const species = [];
        const spawnWeights = this.generateImbalancedPopulations(numTypes);

        for (let i = 0; i < numTypes; i++) {
            const forces = [];
            for (let j = 0; j < numTypes; j++) {
                forces.push(this.calculateForce(i, j, numTypes, forceScale, radius));
            }

            species.push({
                color: [...colors[i], 1.0],
                forces: forces,
                spawnWeight: spawnWeights[i]
            });
        }

        return {
            particleCount: numParticles,
            species: species,
            simulationSize: [1200, 750],
            friction: friction.toString(),
            centralForce: 0,
            symmetricForces: false,
            particleSize: particleSize,
            particleOpacity: particleOpacity
        };
    }

    updateForceParams(params) {
        this.forceParams = { ...this.forceParams, ...params };
    }

    getForceParams() {
        return { ...this.forceParams };
    }
}