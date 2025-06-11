// const express = require('express');
// const path = require('path');

// const app = express();
// const PORT = 3000;

// // Set proper MIME types for different file extensions
// app.use((req, res, next) => {
//     // Set MIME type for JavaScript files
//     if (req.url.endsWith('.js')) {
//         res.type('application/javascript');
//     }
//     // Set MIME type for WebGPU shaders
//     else if (req.url.endsWith('.wgsl')) {
//         res.type('text/plain');
//     }
//     // Set MIME type for JSON files
//     else if (req.url.endsWith('.json')) {
//         res.type('application/json');
//     }
//     // Set MIME type for CSS files
//     else if (req.url.endsWith('.css')) {
//         res.type('text/css');
//     }
//     next();
// });

// // Serve static files from the project root
// app.use(express.static(path.join(__dirname), {
//     setHeaders: (res, path, stat) => {
//         // Additional MIME type handling
//         if (path.endsWith('.js')) {
//             res.set('Content-Type', 'application/javascript');
//         } else if (path.endsWith('.wgsl')) {
//             res.set('Content-Type', 'text/plain');
//         }
//     }
// }));

// // Handle 404 errors
// app.use((req, res) => {
//     res.status(404).send(`
//         <html>
//             <body>
//                 <h1>File Not Found</h1>
//                 <p>The file <code>${req.url}</code> was not found on this server.</p>
//                 <p>Make sure all files are in the correct locations:</p>
//                 <ul>
//                     <li>JavaScript files should be in the project root or js/ folder</li>
//                     <li>Shader files should be in the shaders/ folder</li>
//                     <li>CSS files should be in the styles/ folder</li>
//                 </ul>
//             </body>
//         </html>
//     `);
// });

// // Start the server
// app.listen(PORT, () => {
//     console.log(`Server running at http://localhost:${PORT}`);
//     console.log('Make sure your files are organized as follows:');
//     console.log('- index.html (in root)');
//     console.log('- webgpu-utils.js (in root)');
//     console.log('- particle-life-simulator.js (in root)');
//     console.log('- main.js (in root)');
//     console.log('- shaders/particle-compute.wgsl');
//     console.log('- shaders/particle-render.wgsl');
//     console.log('- particle-life-system.json (in root)');
// });