/**
 * Responsive Canvas System for Particle Life Simulator
 * Automatically sizes the simulation based on screen dimensions
 */

class ResponsiveCanvasSystem {
    constructor() {
        this.maxWidth = 1600;   // Maximum simulation width for very large screens
        this.maxHeight = 1000;  // Maximum simulation height for very large screens
        this.minWidth = 0;      // No minimum width - let it scale down
        this.minHeight = 0;     // No minimum height - let it scale down
        this.padding = 7;       // Padding from screen edges
        this.rightPanelWidth = 0; //205; // Width of control panel
        this.panelOpen = true;  // Track panel state

        this.currentSize = { width: 1000, height: 800 };
        this.simulator = null;

        this.setupResizeListener();
    }

    /**
     * Calculate optimal canvas size based on screen dimensions
     */
    calculateOptimalSize() {
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        // Account for right panel and padding using the updated values
        const panelWidth = this.panelOpen ? this.rightPanelWidth : 0;
        const availableWidth = screenWidth - panelWidth - (this.padding * 2);
        const availableHeight = screenHeight - (this.padding * 2);

        // console.log('Screen dimensions:', screenWidth, 'x', screenHeight);
        // console.log('Panel open:', this.panelOpen, 'Available space:', availableWidth, 'x', availableHeight);

        // Calculate size while respecting max/min constraints
        let targetWidth = Math.min(Math.max(availableWidth, this.minWidth), this.maxWidth);
        let targetHeight = Math.min(Math.max(availableHeight, this.minHeight), this.maxHeight);

        // Maintain a reasonable aspect ratio (prefer 16:10 to 4:3 range)
        const aspectRatio = targetWidth / targetHeight;

        // Comment out aspect ratio adjustments to allow natural scaling
        // If aspect ratio is too wide, reduce width
        // if (aspectRatio > 1.8) {
        //     targetWidth = targetHeight * 1.6;
        // }
        // If aspect ratio is too tall, reduce height  
        // else if (aspectRatio < 0.8) {
        //     targetHeight = targetWidth * 0.8;
        // }

        // Ensure we don't exceed screen bounds after adjustment
        if (targetWidth > availableWidth) {
            const scale = availableWidth / targetWidth;
            targetWidth = availableWidth;
            targetHeight = targetHeight * scale;
        }

        if (targetHeight > availableHeight) {
            const scale = availableHeight / targetHeight;
            targetHeight = availableHeight;
            targetWidth = targetWidth * scale;
        }

        // Round to even numbers for cleaner appearance
        targetWidth = Math.floor(targetWidth / 2) * 2;
        targetHeight = Math.floor(targetHeight / 2) * 2;

        return {
            width: targetWidth,
            height: targetHeight,
            aspectRatio: targetWidth / targetHeight
        };
    }

    /**
     * Apply calculated size to canvas and update simulation
     */
    applyCanvasSize(size = null) {
        const mainContainer = document.querySelector('.main-container');
        const isFullscreen = mainContainer && mainContainer.classList.contains('fullscreen');
        const canvas = document.getElementById('webgpu-canvas');
        if (!canvas) {
            console.error('Canvas not found');
            return false;
        }

        if (isFullscreen) {
            // In fullscreen, use the full window size and devicePixelRatio
            const dpr = window.devicePixelRatio || 1;
            const width = window.innerWidth;
            const height = window.innerHeight;
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            canvas.style.width = width + 'px';
            canvas.style.height = height + 'px';
            this.currentSize = { width, height, aspectRatio: width / height };
            // No centering in fullscreen
        } else {
            if (!size) {
                size = this.calculateOptimalSize();
            }

            // Only resize if dimensions actually changed
            if (canvas.width === size.width && canvas.height === size.height) {
                // console.log('Canvas size unchanged, skipping resize');
                return true;
            }

            // console.log(`Resizing canvas from ${canvas.width}x${canvas.height} to ${size.width}x${size.height}`);
            // console.log(`Aspect ratio: ${size.aspectRatio.toFixed(2)}:1`);

            // Update canvas dimensions
            canvas.width = size.width;
            canvas.height = size.height;
            canvas.style.width = size.width + 'px';
            canvas.style.height = size.height + 'px';

            this.currentSize = size;

            // Center the canvas container
            this.centerCanvas();
        }

        // Update simulator aspect ratio if available
        if (this.simulator && this.simulator.updateAspectRatio) {
            this.simulator.updateAspectRatio();
            // console.log('Simulator aspect ratio updated');
        }

        return true;
    }

    /**
     * Center the canvas container on screen
     */
    centerCanvas() {
        const mainContainer = document.querySelector('.main-container');
        if (mainContainer && mainContainer.classList.contains('fullscreen')) return; // Skip centering in fullscreen
        const canvasContainer = document.querySelector('.canvas-container');
        if (!canvasContainer) return;

        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        // Calculate centering (accounting for right panel)
        const effectiveScreenWidth = screenWidth - this.rightPanelWidth;
        const leftMargin = Math.max(0, (effectiveScreenWidth - this.currentSize.width) / 2);
        const topMargin = Math.max(0, (screenHeight - this.currentSize.height) / 2);

        canvasContainer.style.position = 'absolute';
        canvasContainer.style.left = this.padding + 'px';
        canvasContainer.style.top = this.padding + 'px';

        // console.log(`Canvas positioned at: ${this.padding}px, ${this.padding}px`);
    }

    /**
     * Set up automatic resize handling
     */
    setupResizeListener() {
        let resizeTimeout;

        window.addEventListener('resize', () => {
            // Debounce resize events
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                // console.log('Window resized, recalculating canvas size...');
                this.applyCanvasSize();
            }, 250);
        });

        // Handle orientation change on mobile
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                // console.log('Orientation changed, recalculating canvas size...');
                this.applyCanvasSize();
            }, 500); // Delay to allow orientation to complete
        });

        // console.log('Resize listeners set up');
    }

    /**
     * Initialize the responsive system
     */
    initialize(simulator = null) {
        this.simulator = simulator;

        // console.log('Initializing responsive canvas system...');
        // console.log('Max dimensions:', this.maxWidth, 'x', this.maxHeight);
        // console.log('Min dimensions:', this.minWidth, 'x', this.minHeight);

        // Apply initial size
        const success = this.applyCanvasSize();

        if (success) {
            console.log('✓ Responsive canvas system initialized');
            // console.log('Current size:', this.currentSize);
        }

        return success;
    }

    /**
     * Set simulator reference after initialization
     */
    setSimulator(simulator) {
        this.simulator = simulator;
        // console.log('Simulator reference set for responsive system');
    }

    /**
     * Get current canvas size info
     */
    getCurrentSize() {
        return {
            ...this.currentSize,
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight,
            canvasElement: document.getElementById('webgpu-canvas')
        };
    }

    /**
     * Force a specific size (for testing)
     */
    setSize(width, height) {
        const customSize = {
            width: Math.max(this.minWidth, Math.min(width, this.maxWidth)),
            height: Math.max(this.minHeight, Math.min(height, this.maxHeight)),
            aspectRatio: width / height
        };

        // console.log(`Setting custom size: ${customSize.width}x${customSize.height}`);
        this.applyCanvasSize(customSize);
    }

    /**
     * Update configuration based on current canvas size
     */
    updateSimulationConfig() {
        if (!this.simulator || !this.simulator.config) return;

        // Update simulation size in config to match canvas
        this.simulator.config.simulationSize = [this.currentSize.width, this.currentSize.height];

        // console.log('Simulation config updated with new size');
    }

    /**
     * Get recommended particle count based on canvas size
     */
    getRecommendedParticleCount() {
        const area = this.currentSize.width * this.currentSize.height;
        const baseArea = 1000 * 800; // Base reference area
        const baseParticles = 10000; // Base particle count

        // Scale particle count with area, but not linearly (use square root for performance)
        const scaleFactor = Math.sqrt(area / baseArea);
        const recommendedCount = Math.round(baseParticles * scaleFactor);

        // Clamp to reasonable bounds
        return Math.max(5000, Math.min(20000, recommendedCount));
    }

    /**
     * Get device category for different optimizations
     */
    getDeviceCategory() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const area = width * height;

        if (width <= 768) {
            return 'mobile';
        } else if (width <= 1200 || area <= 1200 * 800) {
            return 'tablet';
        } else if (area <= 1600 * 1000) {
            return 'desktop';
        } else {
            return 'large-desktop';
        }
    }

    /**
     * Apply device-specific optimizations
     */
    applyDeviceOptimizations() {
        const category = this.getDeviceCategory();
        const size = this.getCurrentSize();

        // console.log(`Device category: ${category}`);
        // console.log(`Recommended particles: ${this.getRecommendedParticleCount()}`);

        // You can use this info to adjust particle counts, quality settings, etc.
        return {
            category,
            recommendedParticles: this.getRecommendedParticleCount(),
            currentSize: size
        };
    }

    /**
     * Toggle panel state and recalculate canvas size
     */
    togglePanel() {
        this.panelOpen = !this.panelOpen;
        // console.log('Panel toggled:', this.panelOpen ? 'open' : 'closed');
        this.applyCanvasSize();
    }

    /**
     * Set panel state explicitly
     */
    setPanelState(open) {
        this.panelOpen = open;
        // console.log('Panel state set to:', open ? 'open' : 'closed');
        this.applyCanvasSize();
    }
}