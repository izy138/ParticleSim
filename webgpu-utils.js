
// WebGPU utility functions
class WebGPUUtils {
  /**
   * Initialize WebGPU and set up the canvas
   * @param {string} canvasId - ID of the canvas element
   * @returns {Promise<Object>} - WebGPU context objects
   */
  static async initialize(canvasId) {
      const canvas = document.getElementById(canvasId);
      
      if (!canvas) {
          this.showError(`Canvas with id '${canvasId}' not found.`);
          return null;
      }
      
      // Check WebGPU support
      if (!navigator.gpu) {
          this.showError("WebGPU is not supported on this browser.");
          return null;
      }
      
      try {
          // Request adapter
          const adapter = await navigator.gpu.requestAdapter({
              powerPreference: 'high-performance'
          });
          
          if (!adapter) {
              this.showError("Couldn't request WebGPU adapter.");
              return null;
          }
          
          // Get adapter features and limits
          console.log("GPU Adapter Features:", Array.from(adapter.features));
          console.log("GPU Adapter Limits:", adapter.limits);
          
          // Request device with required features and limits
          const requiredFeatures = [];
          
          // Optional features that might be helpful
          const optionalFeatures = ['timestamp-query'];
          for (const feature of optionalFeatures) {
              if (adapter.features.has(feature)) {
                  requiredFeatures.push(feature);
              }
          }
          
          const device = await adapter.requestDevice({
              requiredFeatures,
              requiredLimits: {
                  maxBufferSize: Math.min(adapter.limits.maxBufferSize, 1024 * 1024 * 256),
                  maxStorageBufferBindingSize: Math.min(adapter.limits.maxStorageBufferBindingSize, 1024 * 1024 * 128),
              }
          });
          
          // Listen for device errors
          device.addEventListener('uncapturederror', (event) => {
              console.error('WebGPU device error:', event.error);
              this.showError(`WebGPU device error: ${event.error.message}`);
          });
          
          // Configure canvas context
          const context = canvas.getContext('webgpu');
          
          if (!context) {
              this.showError("Failed to get WebGPU context from canvas.");
              return null;
          }
          
          const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
          
          context.configure({
              device,
              format: presentationFormat,
              alphaMode: 'premultiplied',
          });
          
          return {
              device,
              adapter,
              context,
              canvas,
              presentationFormat
          };
      } catch (error) {
          this.showError(`WebGPU initialization failed: ${error.message}`);
          console.error(error);
          return null;
      }
  }
  
  /**
   * Display error message to user
   * @param {string} message - Error message
   */
  static showError(message) {
      console.error(message);
      
      // Remove any existing error messages
      const existingError = document.querySelector('.webgpu-error');
      if (existingError) {
          existingError.remove();
      }
      
      const container = document.createElement('div');
      container.className = 'webgpu-error';
      container.style.cssText = 'position:fixed; top:0; left:0; right:0; padding:20px; background:#f44336; color:white; text-align:center; font-family:sans-serif; z-index:1000;';
      container.innerHTML = `
          <strong>WebGPU Error:</strong> ${message}
          <button style="margin-left:20px; padding:5px 10px; background:rgba(255,255,255,0.2); border:none; color:white; cursor:pointer;" onclick="this.parentElement.remove()">
              Close
          </button>
      `;
      
      document.body.prepend(container);
  }
  
  /**
   * Create a buffer from data
   * @param {GPUDevice} device - WebGPU device
   * @param {TypedArray} data - Data to store in buffer
   * @param {GPUBufferUsage} usage - Buffer usage flags
   * @returns {GPUBuffer} - Created buffer
   */
  static createBuffer(device, data, usage) {
      const buffer = device.createBuffer({
          size: data.byteLength,
          usage: usage,
          mappedAtCreation: true
      });
      
      const mapped = new data.constructor(buffer.getMappedRange());
      mapped.set(data);
      buffer.unmap();
      
      return buffer;
  }
  
  /**
   * Load shader from file
   * @param {string} path - Path to shader file
   * @returns {Promise<string>} - Shader code
   */
  static async loadShader(path) {
      try {
          const response = await fetch(path);
          if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
          }
          return await response.text();
      } catch (error) {
          console.error(`Failed to load shader: ${path}`, error);
          throw new Error(`Failed to load shader: ${path} - ${error.message}`);
      }
  }
  
  /**
   * Log GPU memory usage (if available)
   * @param {GPUDevice} device - WebGPU device
   */
  static logMemoryUsage(device) {
      if (device.querySet) {
          console.log("GPU Memory usage monitoring not yet implemented");
      }

      
  }
  
}