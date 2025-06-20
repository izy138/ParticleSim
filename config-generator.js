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
        for (let i = 0; i < numTypes; i++) {
            const r = Math.random() * 0.7 + 0.3;
            const g = Math.random() * 0.7 + 0.3;
            const b = Math.random() * 0.7 + 0.3;
            colors.push([r, g, b]);
        }
        return colors;
    }

    calculateForce(typeA, typeB, numTypes, forceScale, radius) {
        // Your existing lava lamp formula
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
        } else {
            for (let i = 0; i < numTypes; i++) {
                weights.push(0.4 / (i + 1));
            }
        }

        const sum = weights.reduce((a, b) => a + b);
        return weights.map(w => w / sum);
    }

    generateLavaLampConfiguration(numTypes = 5, numParticles = 12000, forceScale = 1, radius = 20) {
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
            friction: "50",
            centralForce: 0,
            symmetricForces: false,
            particleSize: 0.007,
            particleOpacity: 0.75
        };
    }

    updateForceParams(params) {
        this.forceParams = { ...this.forceParams, ...params };
    }

    getForceParams() {
        return { ...this.forceParams };
    }
}