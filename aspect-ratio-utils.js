// /**
//  * Aspect Ratio Utilities for Particle Simulator
//  * Handles canvas resizing, aspect ratio testing, and simulator updates
//  */

// class AspectRatioUtils {
//     /**
//      * Test different aspect ratios on the simulator
//      * @param {number} width - Canvas width
//      * @param {number} height - Canvas height
//      * @param {Object} simulator - The particle simulator instance
//      */
//     static testAspectRatio(width, height, simulator) {
//         const canvas = document.getElementById('webgpu-canvas');
//         if (!canvas || !simulator) {
//             console.log('Canvas or simulator not available');
//             return;
//         }

//         console.log(`Setting canvas to ${width}x${height} (aspect ratio: ${(width / height).toFixed(2)}:1)`);

//         canvas.width = width;
//         canvas.height = height;
//         canvas.style.width = width + 'px';
//         canvas.style.height = height + 'px';

//         if (simulator.updateAspectRatio) {
//             simulator.updateAspectRatio();
//             console.log('Aspect ratio updated');
//         }
//     }

//     /**
//      * Update the simulator's aspect ratio
//      * @param {Object} simulator - The particle simulator instance
//      */
//     static updateSimulatorAspectRatio(simulator) {
//         if (simulator && simulator.updateAspectRatio) {
//             simulator.updateAspectRatio();
//             console.log('Aspect ratio manually updated');
//         } else {
//             console.log('Simulator not available or missing updateAspectRatio method');
//         }
//     }

//     /**
//      * Add a test button for aspect ratio testing
//      * @param {Object} simulator - The particle simulator instance
//      */
//     static addAspectRatioTestButton(simulator) {
//         const testBtn = document.createElement('button');
//         testBtn.textContent = 'Test Aspect Ratios';
//         testBtn.className = 'default-btn';
//         testBtn.style.marginTop = '10px';

//         testBtn.addEventListener('click', async () => {
//             if (!simulator) return;

//             const canvas = document.getElementById('webgpu-canvas');
//             const originalWidth = canvas.width;
//             const originalHeight = canvas.height;

//             // Test sequence: wide -> square -> tall -> back to original
//             const testSizes = [
//                 [1111, 600],  // Wide 2:1
//                 [800, 800],   // Square 1:1
//                 [600, 900],   // Tall 2:3
//                 [originalWidth, originalHeight] // Back to original
//             ];

//             testBtn.disabled = true;
//             testBtn.textContent = 'Testing...';

//             for (let i = 0; i < testSizes.length; i++) {
//                 const [width, height] = testSizes[i];

//                 console.log(`Testing aspect ratio: ${width}x${height} (${(width / height).toFixed(2)}:1)`);

//                 // Update canvas size
//                 canvas.width = width;
//                 canvas.height = height;
//                 canvas.style.width = width + 'px';
//                 canvas.style.height = height + 'px';

//                 // Update aspect ratio in simulator
//                 if (simulator.updateAspectRatio) {
//                     simulator.updateAspectRatio();
//                 }

//                 // Wait to see the effect
//                 await new Promise(resolve => setTimeout(resolve, 2000));
//             }

//             testBtn.textContent = 'Test Aspect Ratios';
//             testBtn.disabled = false;

//             console.log('Aspect ratio test complete');
//         });

//         // Add to controls panel
//         const controlsSection = document.querySelector('.right-panel .panel-section');
//         if (controlsSection) {
//             controlsSection.appendChild(testBtn);
//         }
//     }

//     /**
//      * Set up a resize observer for the canvas
//      * @param {Object} simulator - The particle simulator instance
//      */
//     static setupCanvasResizeObserver(simulator) {
//         const canvas = document.getElementById('webgpu-canvas');
//         if (!canvas || !simulator) return;

//         // Use ResizeObserver for more precise canvas size monitoring
//         if (window.ResizeObserver) {
//             const resizeObserver = new ResizeObserver(entries => {
//                 for (let entry of entries) {
//                     if (entry.target === canvas) {
//                         console.log('Canvas dimensions changed:', entry.contentRect.width, 'x', entry.contentRect.height);

//                         // Update aspect ratio when canvas actually changes size
//                         if (simulator.updateAspectRatio) {
//                             simulator.updateAspectRatio();
//                         }
//                     }
//                 }
//             });

//             resizeObserver.observe(canvas);
//             console.log('Canvas resize observer set up');
//         }
//     }
// }

// // Export for use in other modules
// if (typeof module !== 'undefined' && module.exports) {
//     module.exports = AspectRatioUtils;
// } else {
//     // Make available globally for browser use
//     window.AspectRatioUtils = AspectRatioUtils;
// }

// add to main.js if u wanna test

            // // Add aspect ratio testing utilities
            // AspectRatioUtils.addAspectRatioTestButton(simulationManager.simulator);
            
            // // Set up global functions for console testing
            // window.testAspectRatio = (width, height) => 
            //     AspectRatioUtils.testAspectRatio(width, height, simulationManager.simulator);
            
            // window.updateSimulatorAspectRatio = () => 
                // AspectRatioUtils.updateSimulatorAspectRatio(simulationManager.simulator);
            