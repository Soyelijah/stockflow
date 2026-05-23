# Slack GIF Creator Skill

## Overview

Creating animated GIFs and visual content for messaging platforms requires understanding animation techniques, image optimization, and platform-specific constraints. This skill covers programmatic GIF creation, optimization, and integration with Slack and other platforms.

---

## GIF Creation with Canvas API and FFmpeg

### Canvas-Based GIF Creation

```javascript
// src/animators/canvasGifGenerator.js
const { createCanvas } = require('canvas');
const GIFEncoder = require('gif-encoder-2');
const fs = require('fs');

class CanvasGifGenerator {
  constructor(width = 400, height = 300, fps = 10) {
    this.width = width;
    this.height = height;
    this.fps = fps;
    this.frameDelay = 1000 / fps;
  }

  async generateLoadingSpinner(filename, duration = 2000) {
    const gif = new GIFEncoder(this.width, this.height);
    gif.setDelay(this.frameDelay);
    gif.setRepeat(0); // Loop forever
    gif.setQuality(10);
    gif.setSize(this.width, this.height);

    const frameCount = Math.ceil((duration / 1000) * this.fps);

    for (let i = 0; i < frameCount; i++) {
      const canvas = createCanvas(this.width, this.height);
      const ctx = canvas.getContext('2d');

      // Draw background
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, this.width, this.height);

      // Draw spinner
      const centerX = this.width / 2;
      const centerY = this.height / 2;
      const radius = 40;
      const angle = (i / frameCount) * Math.PI * 2;

      // Outer ring
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Animated segment
      ctx.strokeStyle = '#4CAF50';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, angle, angle + Math.PI * 1.5);
      ctx.stroke();

      gif.addFrame(ctx);
    }

    return new Promise((resolve, reject) => {
      gif.render();
      gif.on('finished', (buf) => {
        fs.writeFileSync(filename, buf);
        resolve(filename);
      });
      gif.on('error', reject);
    });
  }

  async generateProgressBar(filename, steps = 10) {
    const gif = new GIFEncoder(this.width, 50);
    gif.setDelay(this.frameDelay);
    gif.setRepeat(0);
    gif.setQuality(10);

    for (let step = 0; step <= steps; step++) {
      const canvas = createCanvas(this.width, 50);
      const ctx = canvas.getContext('2d');

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, this.width, 50);

      // Border
      ctx.strokeStyle = '#cccccc';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, this.width - 2, 48);

      // Progress
      const progress = step / steps;
      const fillWidth = (this.width - 4) * progress;

      // Gradient
      const gradient = ctx.createLinearGradient(0, 0, fillWidth, 0);
      gradient.addColorStop(0, '#4CAF50');
      gradient.addColorStop(1, '#45a049');
      ctx.fillStyle = gradient;
      ctx.fillRect(2, 2, fillWidth, 46);

      // Percentage text
      ctx.fillStyle = '#333333';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(progress * 100)}%`, this.width / 2, 32);

      gif.addFrame(ctx);
    }

    return new Promise((resolve, reject) => {
      gif.render();
      gif.on('finished', (buf) => {
        fs.writeFileSync(filename, buf);
        resolve(filename);
      });
      gif.on('error', reject);
    });
  }

  async generateWaveAnimation(filename, duration = 2000) {
    const gif = new GIFEncoder(this.width, this.height);
    gif.setDelay(this.frameDelay);
    gif.setRepeat(0);
    gif.setQuality(10);

    const frameCount = Math.ceil((duration / 1000) * this.fps);

    for (let frame = 0; frame < frameCount; frame++) {
      const canvas = createCanvas(this.width, this.height);
      const ctx = canvas.getContext('2d');

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, this.width, this.height);

      // Wave pattern
      ctx.strokeStyle = '#2196F3';
      ctx.lineWidth = 2;
      ctx.beginPath();

      const speed = (frame / frameCount) * Math.PI * 4;

      for (let x = 0; x < this.width; x += 5) {
        const y = this.height / 2 + Math.sin((x / 50) + speed) * 30;
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();

      gif.addFrame(ctx);
    }

    return new Promise((resolve, reject) => {
      gif.render();
      gif.on('finished', (buf) => {
        fs.writeFileSync(filename, buf);
        resolve(filename);
      });
      gif.on('error', reject);
    });
  }
}

module.exports = CanvasGifGenerator;
```

### FFmpeg-Based Video to GIF Conversion

```javascript
// src/animators/ffmpegGifConverter.js
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

class FFmpegGifConverter {
  constructor(ffmpegPath = '/usr/bin/ffmpeg') {
    ffmpeg.setFfmpegPath(ffmpegPath);
  }

  async videoToGif(inputFile, outputFile, options = {}) {
    const {
      width = 320,
      height = 240,
      fps = 10,
      startTime = 0,
      duration = 5
    } = options;

    return new Promise((resolve, reject) => {
      ffmpeg(inputFile)
        .setStartTime(startTime)
        .duration(duration)
        .fps(fps)
        .size(`${width}x${height}`)
        .output(outputFile)
        .on('end', () => {
          console.log(`GIF created: ${outputFile}`);
          resolve(outputFile);
        })
        .on('error', (err) => {
          console.error('FFmpeg error:', err);
          reject(err);
        })
        .run();
    });
  }

  async optimizeGif(inputFile, outputFile) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputFile)
        .output(outputFile)
        .outputOptions('-vf', 'split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse')
        .on('end', () => resolve(outputFile))
        .on('error', reject)
        .run();
    });
  }

  async imageSequenceToGif(imagePattern, outputFile, frameRate = 10) {
    // imagePattern example: '/frames/frame_%03d.png'
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(imagePattern)
        .inputFPS(frameRate)
        .output(outputFile)
        .outputOptions('-vf', 'fps=10')
        .on('end', () => resolve(outputFile))
        .on('error', reject)
        .run();
    });
  }

  async createSlideShowGif(imageFiles, outputFile, options = {}) {
    const {
      duration = 2, // seconds per image
      transition = 'fade',
      fps = 10
    } = options;

    const inputFiles = imageFiles.map(f => f).join('|');

    return new Promise((resolve, reject) => {
      let command = ffmpeg();

      imageFiles.forEach(file => {
        command = command.input(file);
      });

      const frameCount = imageFiles.length;
      const totalDuration = frameCount * duration;
      const totalFrames = totalDuration * fps;

      command
        .complexFilter([
          `[0]scale=320:240[v0];${imageFiles.slice(1).map((_, i) => `[${i + 1}]scale=320:240[v${i + 1}]`).join(';')}`,
          `${imageFiles.map((_, i) => `[v${i}]`).join('')}concat=n=${imageFiles.length}:v=1:a=0[v]`,
          `[v]fps=${fps}[out]`
        ].join(';'))
        .output(outputFile)
        .outputOptions('-pix_fmt', 'rgb24')
        .on('end', () => resolve(outputFile))
        .on('error', reject)
        .run();
    });
  }
}

module.exports = FFmpegGifConverter;
```

---

## Animated SVG Generation

### SVG Animation Engine

```javascript
// src/animators/svgAnimator.js
class SVGAnimator {
  constructor(width = 400, height = 300) {
    this.width = width;
    this.height = height;
  }

  generateLoadingDots() {
    return `
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style>
            @keyframes bounce {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-20px); }
            }
            .dot {
              animation: bounce 1.4s infinite;
              fill: #4CAF50;
            }
            .dot-1 { animation-delay: 0s; }
            .dot-2 { animation-delay: 0.2s; }
            .dot-3 { animation-delay: 0.4s; }
          </style>
        </defs>
        <circle class="dot dot-1" cx="${this.width * 0.25}" cy="${this.height / 2}" r="15"/>
        <circle class="dot dot-2" cx="${this.width * 0.5}" cy="${this.height / 2}" r="15"/>
        <circle class="dot dot-3" cx="${this.width * 0.75}" cy="${this.height / 2}" r="15"/>
      </svg>
    `;
  }

  generatePulsingIcon(iconPath) {
    return `
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style>
            @keyframes pulse {
              0% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.7; transform: scale(1.1); }
              100% { opacity: 1; transform: scale(1); }
            }
            .icon { animation: pulse 2s infinite; }
          </style>
        </defs>
        <g class="icon" transform="translate(${this.width / 2}, ${this.height / 2})">
          ${iconPath}
        </g>
      </svg>
    `;
  }

  generateRotatingArrow(direction = 'right') {
    const rotation = {
      right: 0,
      down: 90,
      left: 180,
      up: 270
    }[direction];

    return `
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style>
            @keyframes rotate { to { transform: rotate(360deg); } }
            .arrow { animation: rotate 2s linear infinite; }
          </style>
        </defs>
        <g class="arrow" transform="translate(${this.width / 2}, ${this.height / 2}) rotate(${rotation})">
          <polygon points="0,-50 40,-10 0,50 -40,-10" fill="#2196F3"/>
        </g>
      </svg>
    `;
  }

  generateProgressRing(percent = 0.5) {
    const circumference = 2 * Math.PI * 45;
    const strokeDashoffset = circumference * (1 - percent);

    return `
      <svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style>
            @keyframes fillRing {
              to { stroke-dashoffset: 0; }
            }
            .ring { animation: fillRing 3s ease-in-out infinite; }
          </style>
        </defs>
        <circle cx="${this.width / 2}" cy="${this.height / 2}" r="45" fill="none" stroke="#e0e0e0" stroke-width="4"/>
        <circle class="ring" cx="${this.width / 2}" cy="${this.height / 2}" r="45" fill="none"
                stroke="#4CAF50" stroke-width="4" stroke-dasharray="${circumference}"
                stroke-dashoffset="${strokeDashoffset}" stroke-linecap="round"/>
      </svg>
    `;
  }
}

module.exports = SVGAnimator;
```

---

## Lottie Animation Integration

### Lottie Export Handler

```javascript
// src/animators/lottieHandler.js
const fs = require('fs');
const path = require('path');

class LottieHandler {
  constructor(lottieFilePath) {
    this.lottieFile = JSON.parse(fs.readFileSync(lottieFilePath, 'utf8'));
  }

  // Modify animation properties
  setColor(layerName, colorHex) {
    const rgb = this.hexToRgb(colorHex);
    this.lottieFile.layers = this.lottieFile.layers.map(layer => {
      if (layer.nm === layerName) {
        // Modify color properties in effects
        if (layer.ef) {
          layer.ef.forEach(effect => {
            if (effect.ef) {
              effect.ef.forEach(param => {
                if (param.ty === 3) { // Color property
                  param.v.k = [rgb.r / 255, rgb.g / 255, rgb.b / 255, 1];
                }
              });
            }
          });
        }
      }
      return layer;
    });
    return this;
  }

  setSpeed(speed = 1) {
    this.lottieFile.op = this.lottieFile.op * speed;
    return this;
  }

  setLooping(loop = true) {
    this.lottieFile.loop = loop;
    return this;
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }

  export(outputPath) {
    fs.writeFileSync(outputPath, JSON.stringify(this.lottieFile, null, 2));
    return outputPath;
  }

  // Create HTML preview
  createHTMLPreview(outputPath, lottieScriptUrl = 'https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.10.2/lottie.min.js') {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Lottie Animation Preview</title>
        <style>
          body { margin: 0; padding: 20px; display: flex; justify-content: center; }
          #lottie { width: 400px; height: 400px; }
        </style>
      </head>
      <body>
        <div id="lottie"></div>
        <script src="${lottieScriptUrl}"></script>
        <script>
          lottie.loadAnimation({
            container: document.getElementById('lottie'),
            renderer: 'svg',
            loop: true,
            autoplay: true,
            animationData: ${JSON.stringify(this.lottieFile)}
          });
        </script>
      </body>
      </html>
    `;

    fs.writeFileSync(outputPath, html);
    return outputPath;
  }
}

module.exports = LottieHandler;
```

---

## Slack Emoji Specifications

### Slack Emoji Generator

```javascript
// src/slack/slackEmojiGenerator.js
const { createCanvas } = require('canvas');
const fs = require('fs');

class SlackEmojiGenerator {
  constructor() {
    // Slack emoji specifications
    this.EMOJI_SIZE = 128; // Minimum recommended size
    this.MAX_SIZE = 2000; // Maximum file size in KB
  }

  async generateSimpleEmoji(text, outputFile) {
    const canvas = createCanvas(this.EMOJI_SIZE, this.EMOJI_SIZE);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, this.EMOJI_SIZE, this.EMOJI_SIZE);

    // Border
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, this.EMOJI_SIZE - 2, this.EMOJI_SIZE - 2);

    // Text
    ctx.fillStyle = '#333333';
    ctx.font = `bold ${Math.ceil(this.EMOJI_SIZE * 0.6)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, this.EMOJI_SIZE / 2, this.EMOJI_SIZE / 2);

    return new Promise((resolve, reject) => {
      const buffer = canvas.toBuffer('image/png');
      fs.writeFile(outputFile, buffer, (err) => {
        if (err) reject(err);
        else resolve(outputFile);
      });
    });
  }

  async generateGradientEmoji(startColor, endColor, outputFile) {
    const canvas = createCanvas(this.EMOJI_SIZE, this.EMOJI_SIZE);
    const ctx = canvas.getContext('2d');

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, this.EMOJI_SIZE, this.EMOJI_SIZE);
    gradient.addColorStop(0, startColor);
    gradient.addColorStop(1, endColor);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.EMOJI_SIZE, this.EMOJI_SIZE);

    // Add circle overlay for classic emoji shape
    ctx.beginPath();
    ctx.arc(this.EMOJI_SIZE / 2, this.EMOJI_SIZE / 2, this.EMOJI_SIZE / 2 - 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 2;
    ctx.stroke();

    return new Promise((resolve, reject) => {
      const buffer = canvas.toBuffer('image/png');
      fs.writeFile(outputFile, buffer, (err) => {
        if (err) reject(err);
        else resolve(outputFile);
      });
    });
  }

  async validateForSlack(filePath) {
    const stats = fs.statSync(filePath);
    const fileSizeInKB = stats.size / 1024;

    if (fileSizeInKB > this.MAX_SIZE) {
      throw new Error(`File size ${fileSizeInKB}KB exceeds Slack limit of ${this.MAX_SIZE}KB`);
    }

    // Check dimensions
    const image = require('image-size');
    const dimensions = image(filePath);

    if (dimensions.width < this.EMOJI_SIZE || dimensions.height < this.EMOJI_SIZE) {
      console.warn(`Warning: Emoji size ${dimensions.width}x${dimensions.height} is smaller than recommended ${this.EMOJI_SIZE}x${this.EMOJI_SIZE}`);
    }

    return {
      valid: true,
      fileSize: fileSizeInKB,
      dimensions,
      maxSize: this.MAX_SIZE
    };
  }

  async uploadToSlack(filePath, emojiName, slackClient) {
    const validation = await this.validateForSlack(filePath);

    if (!validation.valid) {
      throw new Error('Emoji validation failed');
    }

    // Upload using Slack Web API
    const fs = require('fs');
    const fileBuffer = fs.readFileSync(filePath);

    try {
      const result = await slackClient.admin.emoji.add({
        name: emojiName,
        image: fileBuffer
      });

      return {
        success: true,
        emojiName,
        url: result.emoji_url
      };
    } catch (error) {
      console.error('Slack upload error:', error);
      throw error;
    }
  }
}

module.exports = SlackEmojiGenerator;
```

---

## Meme Generation

### Meme Generator

```javascript
// src/generators/memeGenerator.js
const { createCanvas, registerFont } = require('canvas');
const fs = require('fs');

class MemeGenerator {
  constructor(imageFile, width = 500, height = 600) {
    this.imageFile = imageFile;
    this.width = width;
    this.height = height;
  }

  async generateMeme(topText, bottomText, outputFile) {
    const image = require('canvas').loadImage(this.imageFile);
    const canvas = createCanvas(this.width, this.height);
    const ctx = canvas.getContext('2d');

    // Draw image
    const img = await image;
    ctx.drawImage(img, 0, 0, this.width, this.height);

    // Draw semi-transparent overlay for text readability
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, this.width, 80); // Top
    ctx.fillRect(0, this.height - 80, this.width, 80); // Bottom

    // Text styling
    ctx.fillStyle = 'white';
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;

    // Draw top text
    const topWords = this.wrapText(topText, 40, this.width - 20);
    let y = 10;
    topWords.forEach(word => {
      ctx.strokeText(word, this.width / 2, y);
      ctx.fillText(word, this.width / 2, y);
      y += 40;
    });

    // Draw bottom text
    ctx.textBaseline = 'bottom';
    const bottomWords = this.wrapText(bottomText, 40, this.width - 20);
    let bottomY = this.height - 10;
    for (let i = bottomWords.length - 1; i >= 0; i--) {
      ctx.strokeText(bottomWords[i], this.width / 2, bottomY);
      ctx.fillText(bottomWords[i], this.width / 2, bottomY);
      bottomY -= 40;
    }

    return new Promise((resolve, reject) => {
      const buffer = canvas.toBuffer('image/png');
      fs.writeFile(outputFile, buffer, (err) => {
        if (err) reject(err);
        else resolve(outputFile);
      });
    });
  }

  wrapText(text, fontSize, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      // Rough estimate: each character takes about 0.5 * fontSize pixels
      const approxWidth = testLine.length * (fontSize * 0.5);

      if (approxWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) lines.push(currentLine);
    return lines;
  }
}

module.exports = MemeGenerator;
```

---

## Status Badge Creation

### Badge Generator

```javascript
// src/generators/badgeGenerator.js
const { createCanvas } = require('canvas');
const fs = require('fs');

class BadgeGenerator {
  // Generate rectangular status badge
  async generateStatusBadge(label, value, color, outputFile) {
    const height = 28;
    const padding = 6;
    const fontSize = 16;

    // Estimate text width
    const labelWidth = label.length * (fontSize * 0.6) + padding * 2;
    const valueWidth = value.length * (fontSize * 0.6) + padding * 2;
    const totalWidth = labelWidth + valueWidth;

    const canvas = createCanvas(totalWidth, height);
    const ctx = canvas.getContext('2d');

    // Label background
    ctx.fillStyle = '#555';
    ctx.fillRect(0, 0, labelWidth, height);

    // Value background
    ctx.fillStyle = color;
    ctx.fillRect(labelWidth, 0, valueWidth, height);

    // Text
    ctx.fillStyle = 'white';
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillText(label, labelWidth / 2, height / 2);
    ctx.fillText(value, labelWidth + valueWidth / 2, height / 2);

    return new Promise((resolve, reject) => {
      const buffer = canvas.toBuffer('image/png');
      fs.writeFile(outputFile, buffer, (err) => {
        if (err) reject(err);
        else resolve(outputFile);
      });
    });
  }

  // Generate circular progress badge
  async generateProgressBadge(percent, outputFile, size = 100) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    const center = size / 2;
    const radius = size / 2 - 5;

    // Background circle
    ctx.fillStyle = '#f0f0f0';
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.fill();

    // Progress arc
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 5;
    ctx.beginPath();
    const endAngle = (percent / 100) * Math.PI * 2;
    ctx.arc(center, center, radius, -Math.PI / 2, -Math.PI / 2 + endAngle);
    ctx.stroke();

    // Text
    ctx.fillStyle = '#333';
    ctx.font = `bold ${Math.ceil(size / 3)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(percent)}%`, center, center);

    return new Promise((resolve, reject) => {
      const buffer = canvas.toBuffer('image/png');
      fs.writeFile(outputFile, buffer, (err) => {
        if (err) reject(err);
        else resolve(outputFile);
      });
    });
  }

  // Generate shield-style badge
  async generateShieldBadge(label, value, color, outputFile) {
    const width = 200;
    const height = 100;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Shield shape
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.moveTo(0, 20);
    ctx.lineTo(width / 2, 0);
    ctx.lineTo(width, 20);
    ctx.lineTo(width, height * 0.6);
    ctx.quadraticCurveTo(width / 2, height, 0, height * 0.6);
    ctx.closePath();
    ctx.fill();

    // Value area
    ctx.fillStyle = color;
    ctx.fillRect(0, height * 0.4, width, height * 0.6);

    // Strokes
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Text
    ctx.fillStyle = 'white';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label, width / 2, 15);

    ctx.font = 'bold 18px Arial';
    ctx.fillText(value, width / 2, 50);

    return new Promise((resolve, reject) => {
      const buffer = canvas.toBuffer('image/png');
      fs.writeFile(outputFile, buffer, (err) => {
        if (err) reject(err);
        else resolve(outputFile);
      });
    });
  }
}

module.exports = BadgeGenerator;
```

---

## Image Optimization for Messaging

### Image Optimizer

```javascript
// src/optimization/imageOptimizer.js
const sharp = require('sharp');
const fs = require('fs');

class ImageOptimizer {
  async optimizeForSlack(inputFile, outputFile) {
    // Slack emoji limit: 128x128 to 2000x2000, <2MB
    return sharp(inputFile)
      .resize(512, 512, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .png({ quality: 80 })
      .toFile(outputFile);
  }

  async optimizeForTwitter(inputFile, outputFile) {
    // Twitter image: 16:9, 1024x512+ recommended
    return sharp(inputFile)
      .resize(1024, 512, {
        fit: 'cover'
      })
      .jpeg({ quality: 85 })
      .toFile(outputFile);
  }

  async optimizeForDiscord(inputFile, outputFile) {
    // Discord emoji: 128x128, <256KB
    return sharp(inputFile)
      .resize(128, 128, {
        fit: 'cover'
      })
      .png({ quality: 80 })
      .toFile(outputFile);
  }

  async createResponsiveSet(inputFile, outputDir) {
    const sizes = [64, 128, 256, 512];
    const results = {};

    for (const size of sizes) {
      const outputPath = `${outputDir}/image-${size}x${size}.png`;
      await sharp(inputFile)
        .resize(size, size, { fit: 'cover' })
        .png({ quality: 80 })
        .toFile(outputPath);

      const stats = fs.statSync(outputPath);
      results[size] = {
        path: outputPath,
        size: stats.size
      };
    }

    return results;
  }

  async getOptimizationStats(inputFile, outputFile) {
    const inputStats = fs.statSync(inputFile);
    const outputStats = fs.statSync(outputFile);

    const reduction = ((inputStats.size - outputStats.size) / inputStats.size) * 100;

    return {
      original: inputStats.size,
      optimized: outputStats.size,
      reductionPercent: reduction.toFixed(2),
      savingBytes: inputStats.size - outputStats.size
    };
  }
}

module.exports = ImageOptimizer;
```

---

## Complete Usage Example

```javascript
// src/examples/createAnimatedContent.js
const CanvasGifGenerator = require('./animators/canvasGifGenerator');
const SlackEmojiGenerator = require('./slack/slackEmojiGenerator');
const BadgeGenerator = require('./generators/badgeGenerator');
const MemeGenerator = require('./generators/memeGenerator');
const ImageOptimizer = require('./optimization/imageOptimizer');

async function createAnimatedContent() {
  // Create loading spinner GIF
  const gifGen = new CanvasGifGenerator(200, 200, 10);
  await gifGen.generateLoadingSpinner('./loading-spinner.gif', 2000);

  // Create Slack emoji
  const emojiGen = new SlackEmojiGenerator();
  await emojiGen.generateSimpleEmoji('✅', './check-emoji.png');
  await emojiGen.generateGradientEmoji('#FF6B6B', '#4ECDC4', './gradient-emoji.png');

  // Create status badges
  const badgeGen = new BadgeGenerator();
  await badgeGen.generateStatusBadge('Build', 'Passing', '#4CAF50', './build-badge.png');
  await badgeGen.generateProgressBadge(75, './progress-75.png');

  // Create meme
  const memeGen = new MemeGenerator('./meme-template.jpg');
  await memeGen.generateMeme('When code works', 'First try', './meme.png');

  // Optimize for platforms
  const optimizer = new ImageOptimizer();
  await optimizer.optimizeForSlack('./check-emoji.png', './check-emoji-slack.png');
  await optimizer.optimizeForDiscord('./gradient-emoji.png', './gradient-emoji-discord.png');

  console.log('All animated content created successfully!');
}

createAnimatedContent().catch(console.error);
```

---

## Best Practices Summary

1. **Size Matters**: Keep GIFs under platform limits (Slack: 2MB, Discord: 256KB)
2. **Frame Rate**: 10 FPS is usually sufficient for smooth animation with small file size
3. **Optimize Colors**: Use palette-based GIFs for better compression
4. **Test on Platform**: Always test emoji/GIFs on target platform before distribution
5. **Accessibility**: Include alt text and descriptive names
6. **Avoid Seizure Triggers**: Don't use rapid flashing (>3Hz)
7. **Keep It Simple**: Complex animations don't scale well to small emoji sizes
8. **Use Lottie for Complex**: Lottie JSON is smaller than animated GIFs for complex animations
9. **Brand Consistency**: Use platform colors and styles
10. **Performance First**: Optimize for mobile and low bandwidth

---

## Resources

- Canvas API: https://html.spec.whatwg.org/multipage/canvas.html
- FFmpeg Documentation: https://ffmpeg.org/documentation.html
- Slack Emoji Guidelines: https://slack.com/help/articles/206870177-Emoji-basics
- Lottie Animation: https://lottiefiles.com/
- Sharp Image Processing: https://sharp.pixelplumbing.com/
- GIF Encoder: https://github.com/jnordberg/gif-encoder-2
