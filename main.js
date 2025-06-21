// main.js - Updated with Responsive Canvas System

// Global variables
let simulationManager;
let uiController;
let responsiveSystem;

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing Particle Life Simulator with Responsive Canvas...');

    try {
        // Show loading state
        showLoadingState();

        // Create and initialize simulation manager (includes responsive system)
        simulationManager = new SimulationManager();
        const initialized = await simulationManager.initialize();

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
    // Add keyboard shortcut for fullscreen
    document.addEventListener('keydown', (event) => {
        if (event.code === 'KeyF' && event.ctrlKey) {
            event.preventDefault();
            toggleFullscreen();
        }
    });

    // Add resize debugging (remove in production)
    let resizeDebounce;
    window.addEventListener('resize', () => {
        clearTimeout(resizeDebounce);
        resizeDebounce = setTimeout(() => {
            if (responsiveSystem) {
                const canvasInfo = responsiveSystem.getCurrentSize();
                console.log('Window resized - Canvas now:', canvasInfo);
            }
        }, 300);
    });

    // Add button for manual canvas resize testing
    addCanvasResizeControls();
}

/**
 * Add manual canvas resize controls for testing
 */
function addCanvasResizeControls() {
    const controlsSection = document.querySelector('.right-panel .panel-section');
    if (!controlsSection) return;

    // Create resize testing section
    const resizeSection = document.createElement('div');
    resizeSection.className = 'panel-section';
    resizeSection.innerHTML = `
        <h3>📐 Canvas Size</h3>
        <button id="resize-auto-btn" class="default-btn">Auto Resize</button>
        <button id="resize-test-btn" class="default-btn">Test Sizes</button>
        <div style="font-size: 10px; margin-top: 5px; color: #000; font-weight: bold;" id="canvas-size-display">
            Loading...
        </div>
    `;

    // Add after the generator section
    const generatorSection = controlsSection.parentElement.children[1];
    if (generatorSection && generatorSection.nextSibling) {
        generatorSection.parentNode.insertBefore(resizeSection, generatorSection.nextSibling);
    } else {
        controlsSection.parentElement.appendChild(resizeSection);
    }

    // Add event listeners
    document.getElementById('resize-auto-btn').addEventListener('click', () => {
        if (responsiveSystem) {
            responsiveSystem.applyCanvasSize();
            updateCanvasSizeDisplay();
        }
    });

    document.getElementById('resize-test-btn').addEventListener('click', testCanvasSizes);

    // Update display
    updateCanvasSizeDisplay();
}

/**
 * Update canvas size display
 */
function updateCanvasSizeDisplay() {
    const display = document.getElementById('canvas-size-display');
    if (!display || !responsiveSystem) return;

    const canvasInfo = responsiveSystem.getCurrentSize();
    const deviceCategory = responsiveSystem.getDeviceCategory();

    display.innerHTML = `
        Size: ${canvasInfo.width}×${canvasInfo.height}<br>
        Ratio: ${canvasInfo.aspectRatio.toFixed(2)}:1<br>
        Device: ${deviceCategory}<br>
        Screen: ${window.innerWidth}×${window.innerHeight}
    `;
}

/**
 * Test different canvas sizes
 */
async function testCanvasSizes() {
    if (!responsiveSystem || !simulationManager.simulator) return;

    const testBtn = document.getElementById('resize-test-btn');
    testBtn.disabled = true;
    testBtn.textContent = 'Testing...';

    const originalSize = responsiveSystem.getCurrentSize();

    const testSizes = [
        { width: 800, height: 600, name: 'Small' },
        { width: 1200, height: 800, name: 'Medium' },
        { width: 1600, height: 900, name: 'Large' },
        { width: 1920, height: 1080, name: 'HD' },
        { width: originalSize.width, height: originalSize.height, name: 'Original' }
    ];

    for (let i = 0; i < testSizes.length; i++) {
        const size = testSizes[i];
        console.log(`Testing ${size.name}: ${size.width}×${size.height}`);

        responsiveSystem.setSize(size.width, size.height);
        updateCanvasSizeDisplay();

        // Wait to see the effect
        await new Promise(resolve => setTimeout(resolve, 1500));
    }

    testBtn.textContent = 'Test Sizes';
    testBtn.disabled = false;

    console.log('Canvas size test complete');
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
    if (!responsiveSystem || !simulationManager.simulator) return;

    const canvasInfo = responsiveSystem.getCurrentSize();
    const deviceInfo = responsiveSystem.applyDeviceOptimizations();

    console.log('=== CURRENT SETUP ===');
    console.log('Canvas:', `${canvasInfo.width}×${canvasInfo.height} (${canvasInfo.aspectRatio.toFixed(2)}:1)`);
    console.log('Screen:', `${canvasInfo.screenWidth}×${canvasInfo.screenHeight}`);
    console.log('Device Category:', deviceInfo.category);
    console.log('Recommended Particles:', deviceInfo.recommendedParticles);
    console.log('Current Particles:', simulationManager.simulator.config.numParticles);

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

    console.log('=== CONSOLE COMMANDS ===');
    console.log('testCanvasSize(width, height) - Test specific canvas size');
    console.log('getCanvasInfo() - Get current canvas information');
    console.log('getDeviceInfo() - Get device optimization info');
    console.log('autoResize() - Trigger automatic resize');
    console.log('Ctrl+F - Toggle fullscreen');
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