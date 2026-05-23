# Algorithmic Art & Generative Design

## Overview

Algorithmic art combines mathematics, randomness, and creative coding to generate unique visual experiences. This skill covers enterprise-grade techniques for building generative art systems, from simple particle systems to complex L-systems and audio-reactive installations.

## P5.js Fundamentals

p5.js is a JavaScript creative coding library that simplifies Canvas API interactions. Perfect for generative art, data visualization, and interactive installations.

### Basic Setup

```javascript
// p5.js sketch template
let xoff = 0;

function setup() {
  createCanvas(1200, 800);
  background(10);
  strokeWeight(2);
}

function draw() {
  // Clear frame or use background() for trails
  background(10, 20); // With alpha for motion blur effect

  // Generate noise-based position
  let x = noise(xoff) * width;
  let y = noise(xoff + 100) * height;

  // Draw with color from hue rotation
  stroke(map(xoff, 0, 1, 0, 360), 100, 100);
  point(x, y);

  xoff += 0.01;
}
```

### Color Mode & HSB

```javascript
// HSB (Hue, Saturation, Brightness) for easy color manipulation
colorMode(HSB, 360, 100, 100, 255); // H: 0-360, S&B: 0-100, A: 0-255

// Create color from hue with dynamic saturation
function getColor(angle, saturation = 80, brightness = 90) {
  return color(
    (angle % 360 + 360) % 360,
    saturation,
    brightness
  );
}

// Color interpolation
function lerpColor(c1, c2, t) {
  let r = lerp(red(c1), red(c2), t);
  let g = lerp(green(c1), green(c2), t);
  let b = lerp(blue(c1), blue(c2), t);
  return color(r, g, b);
}
```

## Perlin Noise & Simplex Noise

Perlin noise generates smooth, natural-looking random values critical for organic procedural generation.

### Perlin Noise Patterns

```javascript
// 1D Perlin noise flow
let noiseScale = 0.01;
let particles = [];

function setup() {
  createCanvas(1000, 600);

  // Initialize particles with random positions
  for (let i = 0; i < 500; i++) {
    particles.push({
      x: random(width),
      y: random(height),
      vx: 0,
      vy: 0,
      life: 255
    });
  }
}

function draw() {
  background(20, 50); // Motion blur with alpha

  particles.forEach((p, idx) => {
    // Multi-dimensional noise for velocity
    let angle = noise(p.x * noiseScale, p.y * noiseScale, frameCount * 0.001) * TWO_PI * 2;

    // Apply force from flow field
    p.vx = cos(angle) * 2;
    p.vy = sin(angle) * 2;

    // Update position
    p.x += p.vx;
    p.y += p.vy;

    // Wrap around edges
    if (p.x < 0) p.x = width;
    if (p.x > width) p.x = 0;
    if (p.y < 0) p.y = height;
    if (p.y > height) p.y = 0;

    // Fade out
    p.life -= 2;

    // Draw particle
    stroke(200, p.life);
    strokeWeight(1);
    point(p.x, p.y);

    // Remove dead particles
    if (p.life <= 0) {
      particles.splice(idx, 1);
    }
  });

  // Add new particles
  if (particles.length < 500) {
    particles.push({
      x: random(width),
      y: random(height),
      vx: 0,
      vy: 0,
      life: 255
    });
  }
}
```

### Fractal Brownian Motion (FBM)

```javascript
// FBM combines multiple Perlin noise octaves
function fbm(x, y, octaves = 4, persistence = 0.5, lacunarity = 2) {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise(x * frequency, y * frequency);
    maxValue += amplitude;

    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return value / maxValue;
}

// Use FBM for terrain/cloud generation
function drawFBMTerrain() {
  let scale = 0.005;

  for (let x = 0; x < width; x += 5) {
    for (let y = 0; y < height; y += 5) {
      let value = fbm(x * scale, y * scale, 6, 0.6, 2);

      // Color based on elevation
      let c;
      if (value < 0.3) c = color(41, 128, 185); // Water
      else if (value < 0.5) c = color(211, 180, 140); // Sand
      else if (value < 0.7) c = color(34, 139, 34); // Grass
      else c = color(100, 100, 100); // Mountain

      fill(c);
      noStroke();
      rect(x, y, 5, 5);
    }
  }
}
```

## Particle Systems

Particle systems simulate natural phenomena like fire, water, smoke, and explosions.

### Basic Particle Engine

```javascript
class Particle {
  constructor(x, y, velocity, life = 255) {
    this.position = createVector(x, y);
    this.velocity = velocity.copy();
    this.acceleration = createVector(0, 0.1); // Gravity
    this.life = life;
    this.maxLife = life;
  }

  applyForce(force) {
    this.acceleration.add(force);
  }

  update() {
    this.velocity.add(this.acceleration);
    this.position.add(this.velocity);
    this.acceleration.mult(0); // Reset acceleration
    this.life -= 2;
  }

  display(color) {
    let alpha = map(this.life, 0, this.maxLife, 0, 255);
    fill(color.levels[0], color.levels[1], color.levels[2], alpha);
    noStroke();
    ellipse(this.position.x, this.position.y, 5);
  }

  isDead() {
    return this.life <= 0;
  }
}

class ParticleSystem {
  constructor(x, y) {
    this.origin = createVector(x, y);
    this.particles = [];
  }

  addParticle(velocity, color) {
    this.particles.push({
      position: this.origin.copy(),
      velocity: velocity,
      acceleration: createVector(0, 0),
      life: 255,
      maxLife: 255,
      color: color,
      applyForce(force) {
        this.acceleration.add(force);
      },
      update() {
        this.velocity.add(this.acceleration);
        this.position.add(this.velocity);
        this.acceleration.mult(0);
        this.life -= 3;
      },
      display() {
        let alpha = map(this.life, 0, this.maxLife, 0, 255);
        stroke(this.color.levels[0], this.color.levels[1], this.color.levels[2], alpha);
        point(this.position.x, this.position.y);
      },
      isDead() {
        return this.life <= 0;
      }
    });
  }

  applyForce(force) {
    this.particles.forEach(p => p.applyForce(force));
  }

  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update();
      if (this.particles[i].isDead()) {
        this.particles.splice(i, 1);
      }
    }
  }

  display() {
    this.particles.forEach(p => p.display());
  }
}

// Usage: Fireworks effect
let systems = [];

function mouseDragged() {
  let sys = new ParticleSystem(mouseX, mouseY);

  for (let i = 0; i < 30; i++) {
    let angle = random(TWO_PI);
    let speed = random(2, 8);
    let velocity = createVector(cos(angle) * speed, sin(angle) * speed);
    let color = color(random(255), random(100, 255), 100);

    sys.addParticle(velocity, color);
  }

  systems.push(sys);
}

function draw() {
  background(10);

  let gravity = createVector(0, 0.3);

  for (let i = systems.length - 1; i >= 0; i--) {
    systems[i].applyForce(gravity);
    systems[i].update();
    systems[i].display();

    if (systems[i].particles.length === 0) {
      systems.splice(i, 1);
    }
  }
}
```

## Flow Fields & Vector Fields

Flow fields use directional vectors to guide particle movement, creating organic patterns.

### Flow Field Implementation

```javascript
class FlowField {
  constructor(resolution = 20) {
    this.resolution = resolution;
    this.cols = Math.ceil(width / resolution);
    this.rows = Math.ceil(height / resolution);
    this.field = [];
    this.update();
  }

  update() {
    // Regenerate field based on time
    let xoff = 0;
    for (let y = 0; y < this.rows; y++) {
      let yoff = 0;
      for (let x = 0; x < this.cols; x++) {
        // Use Perlin noise to determine angle
        let angle = noise(xoff, yoff, frameCount * 0.005) * TWO_PI * 2;

        let index = y * this.cols + x;
        this.field[index] = createVector(cos(angle), sin(angle));

        yoff += 0.1;
      }
      xoff += 0.1;
    }
  }

  lookup(position) {
    let col = Math.floor(position.x / this.resolution);
    let row = Math.floor(position.y / this.resolution);

    col = constrain(col, 0, this.cols - 1);
    row = constrain(row, 0, this.rows - 1);

    let index = row * this.cols + col;
    return this.field[index];
  }

  display() {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        let index = y * this.cols + x;
        let vector = this.field[index];

        let pixelX = x * this.resolution;
        let pixelY = y * this.resolution;

        push();
        translate(pixelX, pixelY);
        stroke(100, 150);
        strokeWeight(1);
        arrow(vector, 5);
        pop();
      }
    }
  }
}

function arrow(vector, scaler) {
  push();
  let angle = atan2(vector.y, vector.x);
  rotate(angle);
  line(0, 0, scaler, 0);
  line(scaler, 0, scaler - 5, -5);
  line(scaler, 0, scaler - 5, 5);
  pop();
}

// Particle following flow field
class FlowFieldParticle {
  constructor(x, y) {
    this.position = createVector(x, y);
    this.velocity = createVector(0, 0);
    this.acceleration = createVector(0, 0);
  }

  applyForce(force) {
    this.acceleration.add(force);
  }

  update() {
    this.velocity.add(this.acceleration);
    this.velocity.limit(4);
    this.position.add(this.velocity);
    this.acceleration.mult(0);
  }

  display() {
    stroke(200);
    strokeWeight(2);
    point(this.position.x, this.position.y);
  }

  checkEdges() {
    if (this.position.x < 0) this.position.x = width;
    if (this.position.x > width) this.position.x = 0;
    if (this.position.y < 0) this.position.y = height;
    if (this.position.y > height) this.position.y = 0;
  }
}

// Usage
let flowField;
let flowParticles = [];

function setup() {
  createCanvas(1000, 800);
  flowField = new FlowField(20);

  for (let i = 0; i < 500; i++) {
    flowParticles.push(new FlowFieldParticle(random(width), random(height)));
  }
}

function draw() {
  background(10);

  flowField.update();
  flowField.display();

  flowParticles.forEach(p => {
    let force = flowField.lookup(p.position);
    force.mult(0.1);
    p.applyForce(force);
    p.update();
    p.checkEdges();
    p.display();
  });
}
```

## L-Systems & Fractals

L-Systems (Lindenmayer Systems) use string rewriting rules to generate complex fractal structures.

### L-System Generator

```javascript
class LSystem {
  constructor(axiom, rules, angle) {
    this.axiom = axiom;
    this.rules = rules; // { 'A': 'AB', 'B': 'AA' }
    this.angle = angle;
    this.current = axiom;
  }

  iterate() {
    let next = '';
    for (let char of this.current) {
      if (this.rules[char]) {
        next += this.rules[char];
      } else {
        next += char;
      }
    }
    this.current = next;
    return this.current;
  }

  render(length = 10, depth = 0) {
    let stack = [];

    for (let char of this.current) {
      if (char === 'F') {
        line(0, 0, length, 0);
        translate(length, 0);
      } else if (char === 'f') {
        translate(length, 0);
      } else if (char === '+') {
        rotate(this.angle);
      } else if (char === '-') {
        rotate(-this.angle);
      } else if (char === '[') {
        push();
        stack.push(true);
      } else if (char === ']') {
        pop();
        stack.pop();
      }
    }
  }
}

// Plant-like structure using L-System
let plant = new LSystem('F', { 'F': 'FF-[-F+F+F]+[+F-F-F]' }, PI / 8);

function setup() {
  createCanvas(800, 1000);
}

function draw() {
  background(20);

  push();
  stroke(100, 200, 100);
  strokeWeight(2);

  translate(width / 2, height);
  rotate(PI);

  // Iterate L-system based on time
  let iterations = floor(frameCount / 60) % 6;
  for (let i = 0; i < iterations; i++) {
    plant.iterate();
  }

  plant.render(5);

  pop();
}

// Classic Sierpinski Triangle using L-System
let sierpinski = new LSystem('A', {
  'A': '+B-A-B+',
  'B': '-A+B+A-'
}, PI / 3);

function drawSierpinski() {
  push();
  translate(200, 200);
  sierpinski.render(1);
  pop();
}
```

## Color Palette Generation

Generate aesthetically pleasing color palettes algorithmically.

### Palette Generation Algorithms

```javascript
// Generate complementary colors
function getComplementary(hue) {
  return (hue + 180) % 360;
}

// Generate triadic colors
function getTriadic(hue) {
  return [hue, (hue + 120) % 360, (hue + 240) % 360];
}

// Generate analogous colors
function getAnalogous(hue, range = 30) {
  return [
    (hue - range + 360) % 360,
    hue,
    (hue + range) % 360
  ];
}

// Generate random harmonic palette using golden ratio
function goldenPalette(baseHue, count = 5) {
  let palette = [];
  let goldenAngle = 360 / 1.618; // Golden ratio angle

  for (let i = 0; i < count; i++) {
    let hue = (baseHue + i * goldenAngle) % 360;
    let saturation = random(60, 100);
    let brightness = random(70, 100);

    palette.push(color(hue, saturation, brightness));
  }

  return palette;
}

// Generate perceptually uniform palette
function perceptualPalette(count = 5) {
  let palette = [];

  for (let i = 0; i < count; i++) {
    let hue = (i / count) * 360;
    let saturation = 65 + (i % 2) * 20; // Alternate saturation
    let brightness = 55 + (i % 3) * 15; // Cycle brightness

    palette.push(color(hue, saturation, brightness));
  }

  return palette;
}

// Color interpolation for smooth gradients
function generateGradient(c1, c2, steps = 256) {
  let gradient = [];

  for (let i = 0; i < steps; i++) {
    let t = i / steps;
    let r = lerp(red(c1), red(c2), t);
    let g = lerp(green(c1), green(c2), t);
    let b = lerp(blue(c1), blue(c2), t);

    gradient.push(color(r, g, b));
  }

  return gradient;
}

// Usage: Draw palette
function drawPalette() {
  let palette = goldenPalette(random(360), 7);
  let w = width / palette.length;

  for (let i = 0; i < palette.length; i++) {
    fill(palette[i]);
    noStroke();
    rect(i * w, 0, w, height);
  }
}
```

## Seeded Randomness for Reproducibility

Seeded randomness ensures generative art is reproducible with the same seed.

```javascript
// Seeded pseudo-random number generator (Park-Miller)
class SeededRandom {
  constructor(seed = 12345) {
    this.seed = seed;
  }

  next() {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  nextInt(max) {
    return Math.floor(this.next() * max);
  }

  nextRange(min, max) {
    return min + this.next() * (max - min);
  }
}

// Usage: Reproducible generative art
let rng = new SeededRandom(1234);

function setup() {
  createCanvas(800, 600);

  // Generate same pattern every time with same seed
  for (let i = 0; i < 100; i++) {
    let x = rng.nextRange(0, width);
    let y = rng.nextRange(0, height);
    let size = rng.nextRange(5, 30);

    fill(rng.nextInt(255), rng.nextInt(255), rng.nextInt(255));
    ellipse(x, y, size);
  }
}

// Hash-based seeding for coordinate-based generation
function seededRandom(x, y, seed = 0) {
  let n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
  return n - Math.floor(n);
}

// Use in generative grid
function drawSeededGrid(cellSize = 20) {
  for (let x = 0; x < width; x += cellSize) {
    for (let y = 0; y < height; y += cellSize) {
      let value = seededRandom(x / cellSize, y / cellSize, 42);

      fill(value * 255);
      noStroke();
      rect(x, y, cellSize, cellSize);
    }
  }
}
```

## SVG Generative Art

Generate scalable vector graphics programmatically for high-quality output.

```javascript
// SVG Generator class
class SVGGenerator {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.elements = [];
  }

  addCircle(x, y, r, fill = 'none', stroke = 'black', strokeWidth = 1) {
    this.elements.push(`
      <circle cx="${x}" cy="${y}" r="${r}"
              fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>
    `);
  }

  addRect(x, y, w, h, fill = 'none', stroke = 'black', strokeWidth = 1) {
    this.elements.push(`
      <rect x="${x}" y="${y}" width="${w}" height="${h}"
            fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>
    `);
  }

  addPath(pathData, fill = 'none', stroke = 'black', strokeWidth = 1) {
    this.elements.push(`
      <path d="${pathData}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>
    `);
  }

  addText(text, x, y, fontSize = 12, fill = 'black') {
    this.elements.push(`
      <text x="${x}" y="${y}" font-size="${fontSize}" fill="${fill}">${text}</text>
    `);
  }

  generate() {
    let svg = `<?xml version="1.0" encoding="UTF-8"?>
    <svg width="${this.width}" height="${this.height}"
         xmlns="http://www.w3.org/2000/svg">
      <style>
        circle { filter: drop-shadow(0 0 2px rgba(0,0,0,0.3)); }
      </style>
      ${this.elements.join('\n')}
    </svg>`;

    return svg;
  }

  downloadSVG(filename = 'generative-art.svg') {
    let svg = this.generate();
    let blob = new Blob([svg], { type: 'image/svg+xml' });
    let url = URL.createObjectURL(blob);

    let link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
  }
}

// Usage: Generate geometric pattern
function generateGeometricSVG() {
  let svg = new SVGGenerator(1200, 1200);

  for (let i = 0; i < 50; i++) {
    let x = Math.random() * 1200;
    let y = Math.random() * 1200;
    let r = Math.random() * 100 + 10;
    let hue = Math.random() * 360;

    svg.addCircle(x, y, r, `hsl(${hue}, 70%, 60%)`, 'none');
  }

  svg.downloadSVG('geometric-pattern.svg');
}
```

## Audio-Reactive Visuals

Create visuals that respond to audio input in real-time.

```javascript
// Audio-reactive visualization with Web Audio API
let audioContext;
let analyser;
let dataArray;
let frequencyData = [];

function setupAudio() {
  // Initialize Web Audio API
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;

  let bufferLength = analyser.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);
  frequencyData = new Array(bufferLength).fill(0);
}

function connectMicrophone() {
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      let source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
    })
    .catch(err => console.error('Microphone access denied:', err));
}

function drawAudioReactive() {
  // Get frequency data
  analyser.getByteFrequencyData(dataArray);

  // Smooth frequency data
  for (let i = 0; i < dataArray.length; i++) {
    frequencyData[i] = frequencyData[i] * 0.8 + dataArray[i] * 0.2;
  }

  background(10);

  // Draw bars responding to frequencies
  let barWidth = width / frequencyData.length;

  for (let i = 0; i < frequencyData.length; i++) {
    let barHeight = (frequencyData[i] / 255) * height;
    let hue = (i / frequencyData.length) * 360;

    fill(hue, 80, 70);
    noStroke();
    rect(i * barWidth, height - barHeight, barWidth, barHeight);
  }
}

// Advanced: Kaleidoscope audio-reactive pattern
function drawAudioKaleidoscope(numSegments = 8) {
  analyser.getByteFrequencyData(dataArray);

  background(10);

  push();
  translate(width / 2, height / 2);

  for (let seg = 0; seg < numSegments; seg++) {
    push();
    rotate((TWO_PI / numSegments) * seg);

    for (let i = 0; i < dataArray.length; i++) {
      let magnitude = map(dataArray[i], 0, 255, 0, 200);
      let angle = (i / dataArray.length) * PI;
      let x = magnitude * cos(angle);
      let y = magnitude * sin(angle);

      stroke(map(i, 0, dataArray.length, 200, 300), 100, 100);
      strokeWeight(2);
      point(x, y);
    }

    pop();
  }

  pop();
}
```

## Canvas API: Raw Performance

For maximum performance, use Canvas API directly instead of p5.js.

```javascript
// Canvas API setup
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
document.body.appendChild(canvas);

// High-performance particle system
class CanvasParticles {
  constructor(count = 1000) {
    this.particles = new Float32Array(count * 2); // x, y pairs
    this.velocities = new Float32Array(count * 2);

    for (let i = 0; i < count * 2; i += 2) {
      this.particles[i] = Math.random() * canvas.width;
      this.particles[i + 1] = Math.random() * canvas.height;
      this.velocities[i] = (Math.random() - 0.5) * 4;
      this.velocities[i + 1] = (Math.random() - 0.5) * 4;
    }
  }

  update() {
    const count = this.particles.length;

    for (let i = 0; i < count; i += 2) {
      // Update position
      this.particles[i] += this.velocities[i];
      this.particles[i + 1] += this.velocities[i + 1];

      // Wrap edges
      if (this.particles[i] < 0) this.particles[i] = canvas.width;
      if (this.particles[i] > canvas.width) this.particles[i] = 0;
      if (this.particles[i + 1] < 0) this.particles[i + 1] = canvas.height;
      if (this.particles[i + 1] > canvas.height) this.particles[i + 1] = 0;
    }
  }

  draw() {
    ctx.fillStyle = 'rgba(10, 10, 10, 0.2)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(200, 150, 255, 0.8)';
    const count = this.particles.length;

    for (let i = 0; i < count; i += 2) {
      ctx.fillRect(this.particles[i], this.particles[i + 1], 2, 2);
    }
  }
}

let particles = new CanvasParticles(5000);

function animate() {
  particles.update();
  particles.draw();
  requestAnimationFrame(animate);
}

animate();
```

## Data-Driven Visualization

Transform data into visual art.

```javascript
// Data as visual representation
function visualizeData(data, width = 800, height = 600) {
  let svg = new SVGGenerator(width, height);

  // Normalize data
  let maxValue = Math.max(...data);
  let minValue = Math.min(...data);
  let range = maxValue - minValue;

  let barWidth = width / data.length;

  for (let i = 0; i < data.length; i++) {
    // Map data value to height
    let normalized = (data[i] - minValue) / range;
    let barHeight = normalized * height * 0.8;
    let x = i * barWidth;
    let y = height - barHeight;

    // Map to color hue based on value
    let hue = normalized * 360;

    svg.addRect(x, y, barWidth - 2, barHeight,
                `hsl(${hue}, 80%, 50%)`, 'none');
  }

  return svg.generate();
}

// Example: Visualize sine wave
let waveData = [];
for (let i = 0; i < 100; i++) {
  let angle = (i / 100) * TWO_PI * 3; // 3 cycles
  waveData.push(Math.sin(angle) * 50 + 50); // Offset and scale
}

let svgOutput = visualizeData(waveData);
console.log(svgOutput); // Can be saved to file
```

## Performance Optimization

Techniques for running generative art smoothly.

```javascript
// Limit frame rate for consistent updates
function setup() {
  createCanvas(1200, 800);
  frameRate(60); // Cap at 60 FPS
}

// Use offscreen buffer for expensive operations
let buffer;

function setup() {
  createCanvas(1200, 800);
  buffer = createGraphics(width, height);
}

function draw() {
  // Update buffer every 5 frames
  if (frameCount % 5 === 0) {
    buffer.background(10);
    buffer.stroke(200);
    // Expensive drawing operations
    for (let i = 0; i < 1000; i++) {
      let x = random(buffer.width);
      let y = random(buffer.height);
      buffer.point(x, y);
    }
  }

  image(buffer, 0, 0);
}

// GPU acceleration with WebGL (via p5.js)
function setup() {
  createCanvas(1200, 800, WEBGL); // Enable WebGL
}

// Use webgl shaders for pixel-level operations
const vertexShader = `
  attribute vec3 aPosition;
  void main() {
    gl_Position = vec4(aPosition, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;
  uniform vec2 resolution;
  uniform float time;

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution;
    vec3 col = 0.5 + 0.5 * cos(time + uv.xyx + vec3(0.0, 2.0, 4.0));
    gl_FragColor = vec4(col, 1.0);
  }
`;
```

## Export & Integration

Save your generative art in various formats.

```javascript
// Save p5.js canvas as image
function saveImage() {
  saveCanvas('generative-art', 'png');
}

// Save high-resolution versions
function saveHighRes(scaleFactor = 2) {
  // Render at 2x resolution
  let hires = createGraphics(width * scaleFactor, height * scaleFactor);

  // Redraw at higher scale
  // ... drawing code with scaling applied

  hires.save('generative-art-hires.png');
}

// Export to SVG
function exportSVG() {
  beginRecord(SVG, 'output.svg');
  // Drawing code
  endRecord();
}

// Real-time streaming to server
async function uploadGenerativeArt() {
  canvas.toBlob(blob => {
    let formData = new FormData();
    formData.append('image', blob, 'art.png');
    formData.append('seed', currentSeed);
    formData.append('timestamp', new Date().toISOString());

    fetch('/api/upload-art', { method: 'POST', body: formData })
      .then(r => r.json())
      .then(data => console.log('Uploaded:', data.id));
  });
}
```

## Enterprise Applications

Generative art in production systems.

- **Brand identity**: Generate variations of logos maintaining brand guidelines
- **Dynamic UI backgrounds**: Create unique, anti-bot backgrounds for each user session
- **Data storytelling**: Transform complex metrics into visual narratives
- **Real-time dashboards**: Animate business KPIs with particle flows or flow fields
- **Game assets**: Procedurally generate terrain, particles, and visual effects
- **Personalization**: Generate user-specific visual experiences based on preferences
- **Accessibility**: Sonify data for audio-reactive installations
- **Archive art**: Create timestamp-locked generative pieces (same seed = reproducible art)

