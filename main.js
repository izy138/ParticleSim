// main.js - Simplified entry point for Particle Life Simulator

// Global variables
let simulationManager;
let uiController;

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing Particle Life Simulator...');
    
    try {
        // Create and initialize simulation manager
        simulationManager = new SimulationManager();
        const initialized = await simulationManager.initialize();
        
        if (initialized) {
            // Create UI controller
            uiController = new UIController(simulationManager);
            
            // // Add aspect ratio testing utilities
            // AspectRatioUtils.addAspectRatioTestButton(simulationManager.simulator);
            
            // // Set up global functions for console testing
            // window.testAspectRatio = (width, height) => 
            //     AspectRatioUtils.testAspectRatio(width, height, simulationManager.simulator);
            
            // window.updateSimulatorAspectRatio = () => 
                // AspectRatioUtils.updateSimulatorAspectRatio(simulationManager.simulator);
            
            console.log('✓ Particle Life Simulator initialized successfully!');
            // console.log('Try: testAspectRatio(1200, 600) in console');
        } else {
            console.error('Failed to initialize simulator');
        }
    } catch (error) {
        console.error('Initialization error:', error);
        WebGPUUtils.showError(`Initialization failed: ${error.message}`);
    }
});

// Add CSS for feedback animations (moved from old main.js)
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .changed {
        color: #ff6b35 !important;
        font-weight: bold;
    }
`;
document.head.appendChild(style);

console.log('Main.js loaded. Particle Life Simulator modules ready.');