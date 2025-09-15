// main.js - Updated with Responsive Canvas System

// Global variables
let simulationManager;
let uiController;
let responsiveSystem;

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    // console.log('Initializing Particle Life Simulator with Responsive Canvas...');

    try {
        // Show loading state
        showLoadingState();

        // Create and initialize simulation manager (includes responsive system)
        // window.simulationManager = simulationManager;  // Expose to global scope
        simulationManager = new SimulationManager();
        const initialized = await simulationManager.initialize();
        window.simulationManager = simulationManager;


        if (initialized) {
            // Get responsive system reference
            responsiveSystem = simulationManager.responsiveSystem;

            // Create UI controller
            uiController = new UIController(simulationManager);

            // Set up additional responsive features
            setupResponsiveFeatures();

            // Hide loading state
            hideLoadingState();

            console.log('✓ Particle Life Simulator with Responsive Canvas initialized successfully!');

            // Log current setup
            logCurrentSetup();

        } else {
            console.error('Failed to initialize simulator');
            showError('Failed to initialize simulator. Please check WebGPU support.');
        }
    } catch (error) {
        console.error('Initialization error:', error);
        WebGPUUtils.showError(`Initialization failed: ${error.message}`);
        hideLoadingState();
    }
});

/**
 * Set up additional responsive features
 */
function setupResponsiveFeatures() {
    // Add resize debugging (remove in production)
    let resizeDebounce;
    window.addEventListener('resize', () => {
        clearTimeout(resizeDebounce);
        resizeDebounce = setTimeout(() => {
            if (responsiveSystem) {
                const canvasInfo = responsiveSystem.getCurrentSize();
                // console.log('Window resized - Canvas now:', canvasInfo);
            }
        }, 300);
    });
}

/**
 * Toggle fullscreen mode
 */
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(() => {
            console.log('Entered fullscreen mode');
            // Resize canvas after fullscreen
            setTimeout(() => {
                if (responsiveSystem) {
                    responsiveSystem.applyCanvasSize();
                }
            }, 100);
        });
    } else {
        document.exitFullscreen().then(() => {
            console.log('Exited fullscreen mode');
            // Resize canvas after fullscreen exit
            setTimeout(() => {
                if (responsiveSystem) {
                    responsiveSystem.applyCanvasSize();
                }
            }, 100);
        });
    }
}

/**
 * Show loading state
 */
function showLoadingState() {
    const canvasContainer = document.querySelector('.canvas-container');
    if (canvasContainer) {
        canvasContainer.classList.add('loading');
    }
}

/**
 * Hide loading state
 */
function hideLoadingState() {
    const canvasContainer = document.querySelector('.canvas-container');
    if (canvasContainer) {
        canvasContainer.classList.remove('loading');
    }
}

/**
 * Show error state
 */
function showError(message) {
    const canvasContainer = document.querySelector('.canvas-container');
    if (canvasContainer) {
        canvasContainer.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 400px; color: #ff6b6b; text-align: center; font-size: 16px;">
                <div>
                    <div style="font-size: 48px; margin-bottom: 20px;">❌</div>
                    <div><strong>Error:</strong> ${message}</div>
                    <div style="margin-top: 10px; font-size: 14px; opacity: 0.8;">
                        Please check browser compatibility and reload the page.
                    </div>
                </div>
            </div>
        `;
    }
}

/**
 * Log current setup information
 */
function logCurrentSetup() {
    const simulationManager = window.simulationManager;

    if (!responsiveSystem || !simulationManager.simulator) return;

    const canvasInfo = responsiveSystem.getCurrentSize();
    const deviceInfo = responsiveSystem.applyDeviceOptimizations();

    // console.log('=== CURRENT SETUP ===');
    // console.log('Canvas:', `${canvasInfo.width}×${canvasInfo.height} (${canvasInfo.aspectRatio.toFixed(2)}:1)`);
    // console.log('Screen:', `${canvasInfo.screenWidth}×${canvasInfo.screenHeight}`);
    // console.log('Device Category:', deviceInfo.category);
    // console.log('Recommended Particles:', deviceInfo.recommendedParticles);
    // console.log('Current Particles:', simulationManager.simulator.config.numParticles);

    // Global functions for console testing
    window.testCanvasSize = (width, height) => {
        if (responsiveSystem) {
            responsiveSystem.setSize(width, height);
            updateCanvasSizeDisplay();
            console.log(`Canvas resized to ${width}×${height}`);
        }
    };

    window.getCanvasInfo = () => responsiveSystem ? responsiveSystem.getCurrentSize() : null;
    window.getDeviceInfo = () => responsiveSystem ? responsiveSystem.applyDeviceOptimizations() : null;
    window.autoResize = () => {
        if (responsiveSystem) {
            responsiveSystem.applyCanvasSize();
            updateCanvasSizeDisplay();
        }
    };

    // console.log('=== CONSOLE COMMANDS ===');
    // console.log('testCanvasSize(width, height) - Test specific canvas size');
    // console.log('getCanvasInfo() - Get current canvas information');
    // console.log('getDeviceInfo() - Get device optimization info');
    // console.log('autoResize() - Trigger automatic resize');
    // console.log('Ctrl+F - Toggle fullscreen');
}

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
    
    /* Fullscreen styles */
    .canvas-container:fullscreen {
        background: #000;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    /* Update interval for canvas size display */
    #canvas-size-display {
        transition: background-color 0.3s ease;
    }
    
    #canvas-size-display.updated {
        background-color: rgba(40, 167, 69, 0.2);
        border-radius: 3px;
        padding: 2px;
    }
`;
document.head.appendChild(style);

console.log('Main.js loaded. Particle Life Simulator with Responsive Canvas ready.');