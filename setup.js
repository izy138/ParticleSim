// setup.js - Script to organize files in the correct structure
const fs = require('fs');
const path = require('path');

console.log('Setting up Particle Life Simulator project...');

// Create directories if they don't exist
const directories = ['shaders', 'js', 'styles'];

directories.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath);
        console.log(`Created directory: ${dir}`);
    } else {
        console.log(`Directory already exists: ${dir}`);
    }
});

// Check for required files and suggest where they should be placed
const requiredFiles = [
    { name: 'index.html', location: 'root' },
    { name: 'webgpu-utils.js', location: 'root' },
    { name: 'particle-life-simulator.js', location: 'root' },
    { name: 'main.js', location: 'root' },
    { name: 'particle-life-system.json', location: 'root' },
    { name: 'server.js', location: 'root' },
    { name: 'package.json', location: 'root' },
    { name: 'particle-compute.wgsl', location: 'shaders' },
    { name: 'particle-render.wgsl', location: 'shaders' },
    { name: 'main.css', location: 'styles' }
];

console.log('\nChecking required files:');
requiredFiles.forEach(file => {
    const filePath = file.location === 'root' 
        ? path.join(__dirname, file.name)
        : path.join(__dirname, file.location, file.name);
    
    if (fs.existsSync(filePath)) {
        console.log(`✓ ${file.name} found in ${file.location}`);
    } else {
        console.log(`✗ ${file.name} missing from ${file.location}`);
    }
});

console.log('\nSetup complete! To start the server, run: node server.js');