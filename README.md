Particle Life Simulation

inspired by Sandbox Science Particle Life:
https://sandbox-science.com/particle-life

inspired by:
https://lisyarus.github.io/webgpu/particle-life.html

Using WebGPU
Chrome: turn on hardware acceleration / graphics acceleration.
Safari: Settings > Advanced > Show features for web developers > WebGPU enabled

Optional:
For laptops with mutiple GPU chips:
Settings > System > Display > Graphics > Add an app> 
SELECT: Program Files > Google > Chrome > Application > chrome 
Once chrome is added find it in the list, go to GPU Preference and select your improved graphics GPU chip (ex: NVIDIA)
Restart chrome and access the simulator

Particle simulations for up to 12000 particles, and 2-8 particles types:
Simulation can be paused/unpaused and reset
Mouse cursor can be used to attract or repel particles
Spacebar to randomize forces between particles
Side panel to manipulate force matrices, friction, and force
Save configurations as a json file
Change size and opacity of particles


# WebGPU Particle Life Simulator

A real-time particle life simulation running entirely on the GPU via the WebGPU API. Thousands of particles interact through attraction and repulsion forces, producing complex emergent behaviors — from clustering and swarming to oscillation and chaotic flow.

Inspired by [Particle Life by Sandbox Science](https://sandbox-science.com/particle-life).

**[Live Demo](https://izy138.github.io/ParticleSim/)**

---

## Browser Requirements

WebGPU is required. It is available in recent versions of Chrome and Safari.

**Chrome:**
Settings → System → enable **Hardware acceleration**

**Safari:**
Settings → Advanced → Show features for web developers → Feature Flags → enable **WebGPU**

**Laptop with multiple GPUs (recommended for performance):**
Settings → System → Display → Graphics → Add an app → select Chrome → set GPU Preference to your dedicated GPU (e.g. NVIDIA) → restart Chrome

---

## Features

### Simulation
- Up to **20,000 particles** rendered in real time on the GPU
- **2–8 particle types**, each with unique colors and force relationships
- Configurable **attraction and repulsion** forces between every type pair
- Adjustable **friction**, **force scale**, and **simulation speed**
- Spatial **binning** for GPU-accelerated neighbor lookup, improving performance at high particle counts

### Controls
- **Play / Pause** — toggle simulation
- **Reset Positions** — respawn particles at random positions, keeping current forces
- **Randomize Forces** — generate a new random force matrix
- **Mouse Interaction** — attract or repel particles with the cursor; adjustable strength and radius
- **Update Forces** — apply slider-modified force parameters to the running simulation

### Configuration
- **Generate Random** — create a fully randomized configuration
- **Create Custom Sim** — generate a simulation using current slider values
- **Save** — download the current configuration as a `.json` file
- **Load** — load a previously saved `.json` configuration
- **Drag and drop** — drop a `.json` file onto the canvas to load it

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Randomize forces |
| `N` | Generate new configuration |
| `P` | Pause / Resume |
| `R` | Reset positions |
| `Ctrl+F` | Toggle fullscreen |
| `TAB` | Toggle side panel |
| `Ctrl+S` | Save configuration |
| `Ctrl+L` | Load configuration |

---

## UI Sliders

| Slider | Description |
|--------|-------------|
| Particle Types | Number of species (2–8) |
| Total Particles | Particle count (2,000–20,000) |
| Friction | Velocity damping per frame |
| Force Scale | Global multiplier on all force strengths |
| Simulation Speed | Time step multiplier |
| Particle Size | Visual radius of each particle |
| Opacity | Particle transparency |
| Strength | Force strength range for generation |
| Radius | Interaction radius range for generation |
| Collision Strength | Repulsion at close range |
| Collision Radius | Distance at which collision kicks in |
| Mouse Force Strength | Strength of cursor attract/repel |
| Mouse Force Radius | Radius of cursor influence |

---

## Configuration Files

Configurations are stored as `.json` files and can be saved, loaded, and shared. Example format:

```json
{
  "particleCount": 10000,
  "species": [
    {
      "color": [0.411, 0.983, 0.096, 1],
      "forces": [
        { "strength": 85.2, "radius": 18.4, "collisionStrength": 320, "collisionRadius": 1.8 }
      ]
    }
  ],
  "simulationSize": [1000, 800],
  "friction": "30",
  "centralForce": 0,
  "symmetricForces": false,
  "particleSize": 0.007,
  "particleOpacity": 0.75
}
```

Drop a saved `.json` onto the page or use the **Load** button to restore any configuration.

---

## Project Structure

```
ParticleSim/
├── index.html                    # Main page and UI layout
├── main.js                       # Entry point, initialization
├── particle-life-simulator.js    # Core simulation class (WebGPU)
├── simulation-manager.js         # Simulation lifecycle and config management
├── ui-controller.js              # UI event handling and slider logic
├── config-generator.js           # Random and custom config generation
├── config-utils.js               # Save, load, and validate configurations
├── mouse-interaction.js          # Cursor attract/repel interaction
├── responsive-canvas-system.js   # Canvas sizing across screen sizes
├── security-utils.js             # XSS escaping utilities
├── webgpu-utils.js               # WebGPU device setup and shader loading
└── shaders/
    ├── particle-compute.wgsl     # GPU compute shader (physics)
    ├── particle-render.wgsl      # GPU render shader (drawing)
    └── no-mouse-compute.wgsl     # Compute shader variant without mouse
```

---

## How It Works

Each frame, the simulation runs two GPU passes:

1. **Compute pass** — for every particle, calculates net force from nearby particles using the attraction matrix, then integrates velocity and position. Spatial binning divides the canvas into a grid so each particle only checks neighbors in adjacent bins rather than all other particles.

2. **Render pass** — draws each particle as a colored point at its current position using a render pipeline.

Force between two particles of types A and B follows a piecewise model:
- Inside the collision radius: strong repulsion
- Between collision and interaction radius: attraction or repulsion based on the force matrix entry for (A, B)
- Outside interaction radius: no force

All simulation state lives in GPU buffers. Double buffering (ping-pong) is used so the previous frame's positions are read while the next frame's are written.

---

## Local Development

No build step is required. Serve the project from any static file server:

```bash
# Python
python3 -m http.server 8080

# Node.js (npx)
npx serve .
```

Then open `http://localhost:8080` in Chrome or Safari with WebGPU enabled.

> Opening `index.html` directly as a `file://` URL will not work due to browser security restrictions on loading shaders.

---

## Security

User-controlled values (file names, error messages, loaded config data) are escaped before being inserted into the DOM to prevent XSS. See `security-utils.js`.
