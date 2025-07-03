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
          // Request adapter with better cross-platform compatibility
          let adapter = null;
          
          // Detect platform for specific optimizations
          const isWindows = navigator.platform.indexOf('Win') !== -1;
          console.log(`Platform detected: ${navigator.platform}, Windows: ${isWindows}`);
          
          // Try to get the best adapter available
          // On Windows, powerPreference is ignored, so we'll try without it first
          adapter = await navigator.gpu.requestAdapter();
          
          // If no adapter found, try with power preference (for non-Windows systems)
          if (!adapter) {
              adapter = await navigator.gpu.requestAdapter({
                  powerPreference: 'high-performance'
              });
          }
          
          // If still no adapter, try with low-power preference as last resort
          if (!adapter) {
              adapter = await navigator.gpu.requestAdapter({
                  powerPreference: 'low-power'
              });
          }
          
          if (!adapter) {
              this.showError("Couldn't request WebGPU adapter.");
              return null;
          }
          
          // Log adapter info for debugging
          console.log("Selected GPU Adapter:", adapter.name);
          console.log("GPU Adapter Features:", Array.from(adapter.features));
          console.log("GPU Adapter Limits:", adapter.limits);
          
          // Request device with required features and limits
          const requiredFeatures = [];
          
          // Optional features that might be helpful for performance
          const optionalFeatures = [
              'timestamp-query',
              'shader-f16',
              'uniform-buffer-array-dynamic-indexing',
              'storage-buffer-array-dynamic-indexing'
          ];
          
          for (const feature of optionalFeatures) {
              if (adapter.features.has(feature)) {
                  requiredFeatures.push(feature);
                  console.log(`Enabled WebGPU feature: ${feature}`);
              }
          }
          
          // Optimize device limits for better performance
          const deviceLimits = {
              maxBufferSize: Math.min(adapter.limits.maxBufferSize, 1024 * 1024 * 256),
              maxStorageBufferBindingSize: Math.min(adapter.limits.maxStorageBufferBindingSize, 1024 * 1024 * 128),
              maxComputeWorkgroupSizeX: adapter.limits.maxComputeWorkgroupSizeX,
              maxComputeWorkgroupSizeY: adapter.limits.maxComputeWorkgroupSizeY,
              maxComputeWorkgroupSizeZ: adapter.limits.maxComputeWorkgroupSizeZ,
              maxComputeWorkgroupsPerDimension: adapter.limits.maxComputeWorkgroupsPerDimension,
              maxComputeInvocationsPerWorkgroup: adapter.limits.maxComputeInvocationsPerWorkgroup,
          };
          
          const device = await adapter.requestDevice({
              requiredFeatures,
              requiredLimits: deviceLimits
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
          
          // Optimize context configuration for better performance
          context.configure({
              device,
              format: presentationFormat,
              alphaMode: 'premultiplied',
              usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
              // Add viewFormats for better compatibility
              viewFormats: [presentationFormat]
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