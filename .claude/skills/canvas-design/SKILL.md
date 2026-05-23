# Canvas Design and Visual Creation

## I. SVG Fundamentals

### 1.1 SVG Structure

```typescript
// Basic SVG structure
export function SimpleSVG() {
  return (
    <svg
      width={400}
      height={400}
      viewBox="0 0 400 400"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Viewport fills entire container */}
      {/* viewBox maintains aspect ratio */}

      {/* Basic shapes */}
      <circle cx={200} cy={200} r={50} fill="#0ea5e9" />
      <rect x={100} y={100} width={200} height={200} fill="none" stroke="#333" strokeWidth={2} />
      <polygon points="200,50 350,350 50,350" fill="#ec4899" opacity={0.7} />

      {/* Text */}
      <text x={200} y={300} textAnchor="middle" fontSize={24} fill="#333">
        SVG Text
      </text>
    </svg>
  );
}
```

### 1.2 SVG Best Practices

```typescript
// ✓ Good: Responsive SVG
export function ResponsiveSVG() {
  return (
    <svg
      width="100%"
      height="auto"
      viewBox="0 0 400 400"
      preserveAspectRatio="xMidYMid meet"
      style={{ maxWidth: '100%' }}
    >
      <circle cx={200} cy={200} r={100} fill="#0ea5e9" />
    </svg>
  );
}

// ✗ Bad: Fixed size, doesn't scale
export function BadSVG() {
  return (
    <svg width={400} height={400}>
      {/* Not responsive */}
    </svg>
  );
}

// SVG Optimization
export function OptimizedSVG() {
  return (
    <svg
      width={400}
      height={400}
      viewBox="0 0 400 400"
      // Remove namespaces (handled by React)
      // Use CSS classes instead of inline styles
      className="my-svg"
    >
      <defs>
        {/* Reusable elements */}
        <linearGradient id="grad1">
          <stop offset="0%" stopColor="#0ea5e9" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
      </defs>

      <circle cx={200} cy={200} r={50} fill="url(#grad1)" />
    </svg>
  );
}
```

### 1.3 SVG Paths (Complex Shapes)

```typescript
// Paths for complex shapes
export function PathExamples() {
  return (
    <svg width={400} height={400} viewBox="0 0 400 400">
      {/* Line (L) and Move (M) commands */}
      <path
        d="M 50 50 L 150 150 L 150 50 Z"
        fill="none"
        stroke="#333"
        strokeWidth={2}
      />

      {/* Curve (C) for smooth curves */}
      <path
        d="M 50 200 Q 150 100 250 200 T 450 200"
        fill="none"
        stroke="#0ea5e9"
        strokeWidth={3}
      />

      {/* Arc (A) for circles */}
      <path
        d="M 200 50 A 150 150 0 0 1 350 200"
        fill="none"
        stroke="#ec4899"
        strokeWidth={2}
      />
    </svg>
  );
}

// SVG Path Generator (easier to use)
export class SVGPath {
  private commands: string[] = [];

  moveTo(x: number, y: number): this {
    this.commands.push(`M ${x} ${y}`);
    return this;
  }

  lineTo(x: number, y: number): this {
    this.commands.push(`L ${x} ${y}`);
    return this;
  }

  curveTo(
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number
  ): this {
    this.commands.push(`C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${x} ${y}`);
    return this;
  }

  close(): this {
    this.commands.push('Z');
    return this;
  }

  toString(): string {
    return this.commands.join(' ');
  }
}

// Usage
const path = new SVGPath()
  .moveTo(50, 50)
  .lineTo(150, 150)
  .lineTo(150, 50)
  .close();

<path d={path.toString()} fill="none" stroke="#333" strokeWidth={2} />
```

---

## II. Canvas API Patterns

### 2.1 Basic Canvas Drawing

```typescript
import { useEffect, useRef } from 'react';

export function CanvasExample() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Set canvas resolution (important for retina displays)
    const dpr = window.devicePixelRatio || 1;
    canvasRef.current.width = 400 * dpr;
    canvasRef.current.height = 400 * dpr;
    ctx.scale(dpr, dpr);

    // Draw shapes
    ctx.fillStyle = '#0ea5e9';
    ctx.fillRect(50, 50, 300, 300);

    // Draw circle
    ctx.beginPath();
    ctx.arc(200, 200, 100, 0, Math.PI * 2);
    ctx.fillStyle = '#ec4899';
    ctx.fill();

    // Draw text
    ctx.fillStyle = '#333';
    ctx.font = '24px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Canvas Text', 200, 200);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={400}
      style={{ border: '1px solid #ccc' }}
    />
  );
}
```

### 2.2 Canvas Gradients and Patterns

```typescript
export function GradientsAndPatterns() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const w = 400;
    const h = 400;

    // Linear gradient
    const linearGrad = ctx.createLinearGradient(0, 0, w, 0);
    linearGrad.addColorStop(0, '#0ea5e9');
    linearGrad.addColorStop(1, '#ec4899');

    ctx.fillStyle = linearGrad;
    ctx.fillRect(0, 0, w / 2, h);

    // Radial gradient
    const radialGrad = ctx.createRadialGradient(w / 4, h / 2, 50, w / 4, h / 2, 150);
    radialGrad.addColorStop(0, '#22c55e');
    radialGrad.addColorStop(1, '#15803d');

    ctx.fillStyle = radialGrad;
    ctx.fillRect(w / 2, 0, w / 2, h);

    // Pattern (using canvas as pattern source)
    const patternCanvas = document.createElement('canvas');
    const patternCtx = patternCanvas.getContext('2d');
    if (patternCtx) {
      patternCanvas.width = 10;
      patternCanvas.height = 10;
      patternCtx.fillStyle = '#333';
      patternCtx.fillRect(0, 0, 5, 5);
      patternCtx.fillRect(5, 5, 5, 5);
    }

    const pattern = ctx.createPattern(patternCanvas, 'repeat');
    ctx.fillStyle = pattern || '#999';
    ctx.fillRect(0, h / 2, w, h / 2);
  }, []);

  return <canvas ref={canvasRef} width={400} height={400} />;
}
```

### 2.3 Canvas Performance Tips

```typescript
// ✓ Good: RequestAnimationFrame for animations
export function AnimatedCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  const animate = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, 400, 400);

    // Draw
    ctx.fillStyle = '#0ea5e9';
    ctx.fillRect(50, 50, 300, 300);

    // Continue animation
    animationRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return <canvas ref={canvasRef} width={400} height={400} />;
}

// ✓ Good: Offscreen canvas for complex calculations
export function OffscreenCanvasExample() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Do heavy work on offscreen canvas
    const offscreen = new OffscreenCanvas(400, 400);
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;

    // Complex drawing...
    ctx.fillStyle = '#0ea5e9';
    ctx.fillRect(50, 50, 300, 300);

    // Transfer to main canvas
    const bitmap = offscreen.convertToImageBitmap();
    const mainCtx = canvasRef.current?.getContext('2d');
    mainCtx?.drawImage(bitmap, 0, 0);
  }, []);

  return <canvas ref={canvasRef} width={400} height={400} />;
}
```

---

## III. Data Visualization

### 3.1 Bar Chart

```typescript
interface BarChartData {
  label: string;
  value: number;
  color: string;
}

export function BarChart({ data }: { data: BarChartData[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !data.length) return;

    const width = 600;
    const height = 400;
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Clear
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);

    const maxValue = Math.max(...data.map((d) => d.value));
    const barWidth = chartWidth / data.length;
    const barGap = barWidth * 0.1;

    data.forEach((item, index) => {
      const barHeight = (item.value / maxValue) * chartHeight;
      const x = padding + index * barWidth + barGap / 2;
      const y = height - padding - barHeight;

      // Draw bar
      ctx.fillStyle = item.color;
      ctx.fillRect(x, y, barWidth - barGap, barHeight);

      // Draw label
      ctx.fillStyle = '#333';
      ctx.font = '12px "Inter"';
      ctx.textAlign = 'center';
      ctx.fillText(item.label, x + (barWidth - barGap) / 2, height - padding + 20);

      // Draw value
      ctx.fillText(
        item.value.toString(),
        x + (barWidth - barGap) / 2,
        y - 10
      );
    });

    // Draw axes
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.stroke();
  }, [data]);

  return <canvas ref={canvasRef} width={600} height={400} />;
}

// Usage
<BarChart
  data={[
    { label: 'Q1', value: 120, color: '#0ea5e9' },
    { label: 'Q2', value: 190, color: '#22c55e' },
    { label: 'Q3', value: 150, color: '#eab308' },
    { label: 'Q4', value: 220, color: '#ec4899' },
  ]}
/>
```

### 3.2 Line Chart

```typescript
interface LineChartData {
  points: Array<{ x: number; y: number; label?: string }>;
  color: string;
  strokeWidth?: number;
}

export function LineChart({
  data,
  width = 600,
  height = 400,
}: {
  data: LineChartData[];
  width?: number;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !data.length) return;

    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Clear
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);

    // Get min/max for scaling
    const allPoints = data.flatMap((d) => d.points);
    const maxX = Math.max(...allPoints.map((p) => p.x));
    const maxY = Math.max(...allPoints.map((p) => p.y));
    const minY = Math.min(...allPoints.map((p) => p.y));

    data.forEach(({ points, color, strokeWidth = 2 }) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      ctx.beginPath();

      points.forEach((point, index) => {
        const x = padding + (point.x / maxX) * chartWidth;
        const y = height - padding - ((point.y - minY) / (maxY - minY)) * chartHeight;

        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        // Draw point
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.stroke();
    });

    // Draw grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;

    for (let i = 0; i <= 10; i++) {
      const y = padding + (chartHeight / 10) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }
  }, [data, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} />;
}
```

### 3.3 Pie Chart

```typescript
interface PieChartData {
  label: string;
  value: number;
  color: string;
}

export function PieChart({ data }: { data: PieChartData[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !data.length) return;

    const width = 400;
    const height = 400;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = 150;

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);

    const total = data.reduce((sum, item) => sum + item.value, 0);
    let currentAngle = -Math.PI / 2; // Start at top

    data.forEach(({ label, value, color }) => {
      const sliceAngle = (value / total) * Math.PI * 2;

      // Draw slice
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      ctx.closePath();
      ctx.fill();

      // Draw label
      const labelAngle = currentAngle + sliceAngle / 2;
      const labelRadius = radius * 0.7;
      const labelX = centerX + Math.cos(labelAngle) * labelRadius;
      const labelY = centerY + Math.sin(labelAngle) * labelRadius;

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px "Inter"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.round((value / total) * 100)}%`, labelX, labelY);

      // Draw legend
      const legendY = 20 + data.indexOf({ label, value, color }) * 20;
      ctx.fillStyle = color;
      ctx.fillRect(10, legendY, 15, 15);
      ctx.fillStyle = '#333';
      ctx.textAlign = 'left';
      ctx.fillText(label, 30, legendY + 7.5);

      currentAngle += sliceAngle;
    });
  }, [data]);

  return <canvas ref={canvasRef} width={400} height={400} />;
}
```

---

## IV. Infographic Creation

### 4.1 Timeline Infographic

```typescript
interface TimelineEvent {
  year: number;
  title: string;
  description: string;
  color: string;
}

export function TimelineInfographic({
  events,
}: {
  events: TimelineEvent[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const width = 800;
    const height = 400;
    const padding = 40;
    const lineY = height / 2;

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);

    // Draw timeline line
    ctx.strokeStyle = '#cbd5e0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, lineY);
    ctx.lineTo(width - padding, lineY);
    ctx.stroke();

    const eventWidth = (width - padding * 2) / events.length;

    events.forEach(({ year, title, description, color }, index) => {
      const x = padding + index * eventWidth + eventWidth / 2;

      // Draw circle marker
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, lineY, 10, 0, Math.PI * 2);
      ctx.fill();

      // Draw year
      ctx.fillStyle = '#333';
      ctx.font = 'bold 14px "Inter"';
      ctx.textAlign = 'center';
      ctx.fillText(year.toString(), x, lineY - 30);

      // Draw title and description
      const isAbove = index % 2 === 0;
      const textY = isAbove ? lineY - 60 : lineY + 60;

      ctx.font = 'bold 12px "Inter"';
      ctx.fillText(title, x, textY);

      ctx.font = '10px "Inter"';
      ctx.fillStyle = '#666';
      const words = description.split(' ');
      let line = '';

      words.forEach((word) => {
        const testLine = line + (line ? ' ' : '') + word;
        if (ctx.measureText(testLine).width > eventWidth - 10) {
          ctx.fillText(line, x, textY + 15);
          line = word;
        } else {
          line = testLine;
        }
      });

      if (line) ctx.fillText(line, x, textY + 15);
    });
  }, [events]);

  return <canvas ref={canvasRef} width={800} height={400} />;
}
```

### 4.2 Stats Card

```typescript
interface StatCard {
  label: string;
  value: string | number;
  change?: { value: number; isPositive: boolean };
  icon?: string;
}

export function StatsCard({
  label,
  value,
  change,
  icon,
}: StatCard) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const width = 300;
    const height = 150;

    // Background
    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(0, 0, width, height);

    // Border
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width, height);

    // Icon (if present)
    let textX = 20;
    if (icon) {
      ctx.font = 'bold 40px Arial';
      ctx.fillText(icon, 20, 60);
      textX = 80;
    }

    // Label
    ctx.fillStyle = '#666';
    ctx.font = '12px "Inter"';
    ctx.fillText(label, textX, 30);

    // Value
    ctx.fillStyle = '#1a202c';
    ctx.font = 'bold 32px "Inter"';
    ctx.fillText(value.toString(), textX, 75);

    // Change indicator
    if (change) {
      ctx.fillStyle = change.isPositive ? '#22c55e' : '#ef4444';
      ctx.font = 'bold 12px "Inter"';
      ctx.fillText(
        `${change.isPositive ? '↑' : '↓'} ${Math.abs(change.value)}%`,
        textX,
        110
      );
    }
  }, [label, value, change, icon]);

  return <canvas ref={canvasRef} width={300} height={150} />;
}
```

---

## V. Social Media Asset Generation

### 5.1 Social Media Post (Instagram/Twitter)

```typescript
interface SocialPost {
  title: string;
  subtitle?: string;
  backgroundColor: string;
  accentColor: string;
}

export function SocialMediaPost({
  title,
  subtitle,
  backgroundColor,
  accentColor,
}: SocialPost) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const width = 1080; // Instagram square
    const height = 1080;

    // Background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Accent shape
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.ellipse(width / 2, height / 2, 300, 400, Math.PI / 6, 0, Math.PI * 2);
    ctx.fill();

    // Title
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 72px "Inter"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Word wrap title
    const titleLines = title.split('\n');
    titleLines.forEach((line, index) => {
      ctx.fillText(line, width / 2, height / 2 - 100 + index * 80);
    });

    // Subtitle
    if (subtitle) {
      ctx.font = '32px "Inter"';
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText(subtitle, width / 2, height / 2 + 150);
    }

    // Watermark
    ctx.font = '24px "Inter"';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'right';
    ctx.fillText('yoursite.com', width - 40, height - 40);
  }, [title, subtitle, backgroundColor, accentColor]);

  return <canvas ref={canvasRef} width={1080} height={1080} />;
}
```

---

## VI. PDF Export

### 6.1 Canvas to PDF

```typescript
import { jsPDF } from 'jspdf';

export function exportCanvasToPDF(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  filename: string
) {
  if (!canvasRef.current) return;

  const canvas = canvasRef.current;
  const imageData = canvas.toDataURL('image/png');

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();

  pdf.addImage(imageData, 'PNG', 0, 0, width, height);
  pdf.save(filename);
}

// Usage
<button
  onClick={() => exportCanvasToPDF(canvasRef, 'chart.pdf')}
>
  Export to PDF
</button>
```

### 6.2 Canvas to PNG

```typescript
export function exportCanvasToPNG(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  filename: string
) {
  if (!canvasRef.current) return;

  const link = document.createElement('a');
  link.href = canvasRef.current.toDataURL('image/png');
  link.download = filename;
  link.click();
}

// High-resolution export (2x scale)
export function exportCanvasHighRes(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  filename: string,
  scale = 2
) {
  if (!canvasRef.current) return;

  const canvas = canvasRef.current;
  const scaledCanvas = document.createElement('canvas');
  scaledCanvas.width = canvas.width * scale;
  scaledCanvas.height = canvas.height * scale;

  const ctx = scaledCanvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(scale, scale);
  ctx.drawImage(canvas, 0, 0);

  const link = document.createElement('a');
  link.href = scaledCanvas.toDataURL('image/png');
  link.download = filename;
  link.click();
}
```

---

## VII. Color Theory in Visualizations

### 7.1 Color Palettes for Data

```typescript
// Sequential (for continuous data)
export const sequentialPalette = [
  '#f7fbff',
  '#deebf7',
  '#c6dbef',
  '#9ecae1',
  '#6baed6',
  '#4292c6',
  '#2171b5',
  '#08519c',
  '#08306b',
];

// Diverging (for data with meaningful midpoint)
export const divergingPalette = [
  '#d73027',
  '#f46d43',
  '#fdae61',
  '#fee090',
  '#ffffbf',
  '#e0f3f8',
  '#abd9e9',
  '#74add1',
  '#4575b4',
];

// Qualitative (for categorical data)
export const qualitativePalette = [
  '#1f77b4',
  '#ff7f0e',
  '#2ca02c',
  '#d62728',
  '#9467bd',
  '#8c564b',
  '#e377c2',
  '#7f7f7f',
];

// Colorblind-safe palette
export const colorblindSafePalette = [
  '#332288', // dark blue
  '#117733', // dark green
  '#ddcc77', // tan
  '#cc4125', // red-brown
  '#88ccee', // light blue
  '#44aa99', // teal
];

// Usage in chart
function getChartColor(index: number, palette = qualitativePalette) {
  return palette[index % palette.length];
}
```

### 7.2 Color Accessibility

```typescript
// Ensure sufficient contrast
export function getContrastColor(
  backgroundColor: string
): 'white' | 'black' {
  // Convert hex to RGB
  const r = parseInt(backgroundColor.slice(1, 3), 16);
  const g = parseInt(backgroundColor.slice(3, 5), 16);
  const b = parseInt(backgroundColor.slice(5, 7), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return contrasting color
  return luminance > 0.5 ? 'black' : 'white';
}

// Usage
ctx.fillStyle = backgroundColor;
ctx.fillRect(0, 0, width, height);

ctx.fillStyle = getContrastColor(backgroundColor);
ctx.fillText('Text', 50, 50);
```

---

## VIII. Visual Hierarchy Principles

### 8.1 Size Hierarchy

```typescript
// Largest = most important
// Smallest = least important

interface VisualHierarchy {
  primary: { size: number; weight: 'bold' | 'semibold' };
  secondary: { size: number; weight: 'semibold' | 'normal' };
  tertiary: { size: number; weight: 'normal' };
  caption: { size: number; weight: 'normal' };
}

const hierarchy: VisualHierarchy = {
  primary: { size: 32, weight: 'bold' },      // Headlines
  secondary: { size: 18, weight: 'semibold' }, // Subheadings
  tertiary: { size: 14, weight: 'normal' },   // Body text
  caption: { size: 12, weight: 'normal' },    // Helper text
};
```

### 8.2 Color Hierarchy

```typescript
// Primary color = main focus
// Secondary = supporting
// Tertiary = subtle
// Neutral = background

const colorHierarchy = {
  primary: '#0ea5e9',        // Bright, attention-grabbing
  secondary: '#64748b',      // Muted, supporting
  tertiary: '#cbd5e0',       // Very muted
  neutral: '#f9fafb',        // Background
  accent: '#ec4899',         // Emphasis when needed
};
```

---

## IX. Layout Principles

### 9.1 Grid-Based Layout

```typescript
interface Grid {
  columns: number;
  rows: number;
  gap: number;
  padding: number;
}

export function drawGridBasedLayout(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  grid: Grid
) {
  const { columns, rows, gap, padding } = grid;
  const cellWidth = (width - padding * 2 - gap * (columns - 1)) / columns;
  const cellHeight = (height - padding * 2 - gap * (rows - 1)) / rows;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const x = padding + col * (cellWidth + gap);
      const y = padding + row * (cellHeight + gap);

      // Draw cell
      ctx.strokeStyle = '#ccc';
      ctx.strokeRect(x, y, cellWidth, cellHeight);
    }
  }
}
```

### 9.2 White Space Principles

```typescript
// Breathing room improves readability
// Use consistent spacing ratios (4:6:8:12:16...)

const whitespace = {
  tight: 4,      // Between inline elements
  normal: 8,     // Between related elements
  comfortable: 16, // Between groups
  spacious: 24,  // Between major sections
};
```

---

## X. Canvas/SVG Comparison

| Feature | Canvas | SVG |
|---------|--------|-----|
| **Best for** | Animations, real-time graphics | Icons, logos, interactive graphics |
| **Performance** | Better for many objects | Better for few objects |
| **Scalability** | Raster, doesn't scale well | Vector, infinitely scalable |
| **Accessibility** | Limited (use ARIA) | Better (semantic) |
| **Editing** | Procedural (programmatic only) | Can be edited as text/DOM |
| **Filters/Effects** | Limited | Extensive CSS/SVG filters |
| **File size** | Smaller for complex scenes | Smaller for simple graphics |

---

## XI. Canvas/SVG Design Checklist

- [ ] Resolution set for retina displays (DPI-aware)
- [ ] Color palette uses accessible colors (WCAG AA contrast)
- [ ] Visual hierarchy clear (size, weight, color)
- [ ] White space used effectively (not cramped)
- [ ] Text readable at intended size (minimum 12px)
- [ ] Performance optimized (not re-drawing unnecessarily)
- [ ] Export formats tested (PNG, PDF)
- [ ] Responsive layouts tested at different sizes
- [ ] Legends/labels clear and properly positioned
- [ ] Data values accurately represented
- [ ] Axes/scales labeled where applicable
- [ ] Color-blind safe if categorical data
- [ ] Animation smooth (60fps) if applicable

This guide provides production-ready patterns for creating scalable, accessible visual designs programmatically.
