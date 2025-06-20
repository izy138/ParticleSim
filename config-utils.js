/**
 * Configuration Utilities for Particle Simulator
 * Handles saving, loading, copying, and validating configurations
 */

class ConfigUtils {
    /**
     * Save current configuration to file
     * @param {Object} simulator - The particle simulator instance
     */
    static saveCurrentConfiguration(simulator) {
        if (!simulator || !simulator.config) {
            console.log("No configuration to save");
            return;
        }

        // Create a configuration object in the same format as your JSON
        const configToSave = {
            particleCount: simulator.config.numParticles,
            species: simulator.config.species,
            simulationSize: simulator.config.simulationSize || [1000, 800],
            friction: simulator.config.friction.toString(),
            centralForce: simulator.config.centralForce || 0,
            symmetricForces: simulator.config.symmetricForces || false,
            particleSize: simulator.config.particleSize,
            particleOpacity: simulator.config.particleOpacity
        };

        // Create filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `particle-config-${timestamp}.json`;

        // Create and download the file
        const blob = new Blob([JSON.stringify(configToSave, null, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log(`Configuration saved as ${filename}`);

        // Update the display to show it was saved
        const display = document.getElementById('config-display');
        if (display) {
            const originalText = display.innerHTML;
            display.innerHTML = `<strong style="color: green;">✓ Configuration saved as ${filename}</strong>`;
            setTimeout(() => {
                display.innerHTML = originalText;
            }, 3000);
        }
    }

    /**
     * Copy current configuration to clipboard
     * @param {Object} simulator - The particle simulator instance
     */
    static copyConfigurationToClipboard(simulator) {
        if (!simulator || !simulator.config) {
            console.log("No configuration to copy");
            return;
        }

        // Create a configuration object in the same format as your JSON
        const configToCopy = {
            particleCount: simulator.config.numParticles,
            species: simulator.config.species,
            simulationSize: simulator.config.simulationSize || [1000, 800],
            friction: simulator.config.friction.toString(),
            centralForce: simulator.config.centralForce || 0,
            symmetricForces: simulator.config.symmetricForces || false,
            particleSize: simulator.config.particleSize,
            particleOpacity: simulator.config.particleOpacity
        };

        const configText = JSON.stringify(configToCopy, null, 2);

        // Copy to clipboard
        navigator.clipboard.writeText(configText).then(() => {
            console.log('Configuration copied to clipboard');
            
            // Show feedback
            const display = document.getElementById('config-display');
            if (display) {
                const originalText = display.innerHTML;
                display.innerHTML = `<strong style="color: blue;">✓ Configuration copied to clipboard!</strong>`;
                setTimeout(() => {
                    display.innerHTML = originalText;
                }, 3000);
            }
        }).catch(err => {
            console.error('Failed to copy configuration:', err);
            
            // Fallback: show in alert
            alert('Configuration copied to clipboard:\n\n' + configText);
        });
    }

    /**
     * Load configuration from file
     * @param {File} file - The file to load configuration from
     * @returns {Promise<Object>} - The loaded configuration object
     */
    static loadConfigurationFromFile(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('No file provided'));
                return;
            }

            const reader = new FileReader();
            
            reader.onload = (event) => {
                try {
                    const config = JSON.parse(event.target.result);
                    
                    // Validate the loaded configuration
                    const validation = this.validateConfiguration(config);
                    if (!validation.isValid) {
                        reject(new Error(`Invalid configuration: ${validation.errors.join(', ')}`));
                        return;
                    }

                    console.log('Configuration loaded from file:', config);
                    resolve(config);
                } catch (error) {
                    reject(new Error(`Failed to parse configuration file: ${error.message}`));
                }
            };

            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };

            reader.readAsText(file);
        });
    }

    /**
     * Validate configuration object
     * @param {Object} config - The configuration object to validate
     * @returns {Object} - Validation result with isValid boolean and errors array
     */
    static validateConfiguration(config) {
        const errors = [];

        // Check if config is an object
        if (!config || typeof config !== 'object') {
            errors.push('Configuration must be an object');
            return { isValid: false, errors };
        }

        // Check required fields
        if (!config.particleCount || typeof config.particleCount !== 'number' || config.particleCount <= 0) {
            errors.push('particleCount must be a positive number');
        }

        if (!config.species || !Array.isArray(config.species) || config.species.length === 0) {
            errors.push('species must be a non-empty array');
        } else {
            // Validate each species
            config.species.forEach((species, index) => {
                if (!species.color || !Array.isArray(species.color) || species.color.length < 3) {
                    errors.push(`species[${index}].color must be an array with at least 3 values (RGB)`);
                }

                if (!species.forces || !Array.isArray(species.forces)) {
                    errors.push(`species[${index}].forces must be an array`);
                } else {
                    species.forces.forEach((force, forceIndex) => {
                        if (typeof force.strength !== 'number') {
                            errors.push(`species[${index}].forces[${forceIndex}].strength must be a number`);
                        }
                        if (typeof force.radius !== 'number' || force.radius <= 0) {
                            errors.push(`species[${index}].forces[${forceIndex}].radius must be a positive number`);
                        }
                    });
                }

                if (typeof species.spawnWeight !== 'number' || species.spawnWeight < 0) {
                    errors.push(`species[${index}].spawnWeight must be a non-negative number`);
                }
            });
        }

        // Check optional fields
        if (config.simulationSize && (!Array.isArray(config.simulationSize) || config.simulationSize.length !== 2)) {
            errors.push('simulationSize must be an array with 2 values [width, height]');
        }

        if (config.friction && (typeof config.friction !== 'string' && typeof config.friction !== 'number')) {
            errors.push('friction must be a string or number');
        }

        if (config.centralForce && typeof config.centralForce !== 'number') {
            errors.push('centralForce must be a number');
        }

        if (config.symmetricForces && typeof config.symmetricForces !== 'boolean') {
            errors.push('symmetricForces must be a boolean');
        }

        if (config.particleSize && (typeof config.particleSize !== 'number' || config.particleSize <= 0)) {
            errors.push('particleSize must be a positive number');
        }

        if (config.particleOpacity && (typeof config.particleOpacity !== 'number' || config.particleOpacity < 0 || config.particleOpacity > 1)) {
            errors.push('particleOpacity must be a number between 0 and 1');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigUtils;
} else {
    // Make available globally for browser use
    window.ConfigUtils = ConfigUtils;
} 