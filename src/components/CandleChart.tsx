import React, { useEffect, useRef, useState } from 'react';
import { Candle } from '../types/index';

interface CandleChartProps {
  candles: Candle[];
}

const CandleChart: React.FC<CandleChartProps> = ({ candles }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [scale, setScale] = useState(1);
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const PADDING = 60;
  const CANDLE_WIDTH = 8 * scale;
  const CANDLE_SPACING = 2;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || candles.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const width = container.clientWidth;
    const height = container.clientHeight;
    canvas.width = width;
    canvas.height = height;

    // Drawing logic
    drawChart(ctx, width, height);
  }, [candles, scrollOffset, scale]);

  const drawChart = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    if (candles.length === 0) return;

    // Calculate visible candles
    const visibleCandles = Math.floor((width - 2 * PADDING) / (CANDLE_WIDTH + CANDLE_SPACING));
    const startIndex = Math.max(0, Math.floor(scrollOffset / (CANDLE_WIDTH + CANDLE_SPACING)));
    const endIndex = Math.min(candles.length, startIndex + visibleCandles + 1);

    const visibleData = candles.slice(startIndex, endIndex);

    if (visibleData.length === 0) return;

    // Calculate min and max for scale
    const prices = visibleData.flatMap((c) => [c.high, c.low]);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;

    // Draw grid and labels
    drawGrid(ctx, width, height, minPrice, maxPrice, priceRange);

    // Draw candles
    let x = PADDING - scrollOffset;
    visibleData.forEach((candle) => {
      drawCandle(ctx, x, candle, minPrice, maxPrice, priceRange, height);
      x += CANDLE_WIDTH + CANDLE_SPACING;
    });

    // Draw crosshair and tooltip if hovering
    if (hoveredCandle) {
      drawTooltip(ctx, width, height, hoveredCandle, minPrice, maxPrice, priceRange);
    }
  };

  const drawGrid = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    minPrice: number,
    maxPrice: number,
    priceRange: number
  ) => {
    const chartHeight = height - 2 * PADDING;
    const gridLines = 6;

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.font = '12px system-ui';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'right';

    for (let i = 0; i <= gridLines; i++) {
      const y = PADDING + (chartHeight / gridLines) * i;
      const price = maxPrice - (priceRange / gridLines) * i;

      // Grid line
      ctx.beginPath();
      ctx.moveTo(PADDING, y);
      ctx.lineTo(width - PADDING, y);
      ctx.stroke();

      // Price label
      ctx.fillText(price.toFixed(5), PADDING - 10, y + 4);
    }

    // Time axis
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    const timeGridSpacing = Math.ceil(20 / (CANDLE_WIDTH + CANDLE_SPACING));

    let x = PADDING - scrollOffset;
    candles.forEach((candle, index) => {
      if (index % timeGridSpacing === 0) {
        const date = new Date(candle.timestamp);
        const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        ctx.fillText(timeStr, x, height - PADDING + 20);
      }
      x += CANDLE_WIDTH + CANDLE_SPACING;
    });
  };

  const drawCandle = (
    ctx: CanvasRenderingContext2D,
    x: number,
    candle: Candle,
    minPrice: number,
    maxPrice: number,
    priceRange: number,
    height: number
  ) => {
    const chartHeight = height - 2 * PADDING;
    const yScale = chartHeight / priceRange;

    // Calculate Y positions
    const yHigh = PADDING + (maxPrice - candle.high) * yScale;
    const yLow = PADDING + (maxPrice - candle.low) * yScale;
    const yOpen = PADDING + (maxPrice - candle.open) * yScale;
    const yClose = PADDING + (maxPrice - candle.close) * yScale;

    const isGreen = candle.close >= candle.open;
    const bodyTop = Math.min(yOpen, yClose);
    const bodyBottom = Math.max(yOpen, yClose);
    const bodyHeight = Math.max(bodyBottom - bodyTop, 1);

    // Wick color
    ctx.strokeStyle = isGreen ? '#26a69a' : '#ef5350';
    ctx.lineWidth = 1;

    // Draw wick
    ctx.beginPath();
    ctx.moveTo(x + CANDLE_WIDTH / 2, yHigh);
    ctx.lineTo(x + CANDLE_WIDTH / 2, yLow);
    ctx.stroke();

    // Draw body
    ctx.fillStyle = isGreen ? '#26a69a' : '#ef5350';
    ctx.fillRect(x + 1, bodyTop, CANDLE_WIDTH - 2, bodyHeight);
  };

  const drawTooltip = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    candle: Candle,
    minPrice: number,
    maxPrice: number,
    priceRange: number
  ) => {
    const chartHeight = height - 2 * PADDING;
    const yScale = chartHeight / priceRange;
    const yClose = PADDING + (maxPrice - candle.close) * yScale;

    // Crosshair
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);

    ctx.beginPath();
    ctx.moveTo(tooltipPos.x, PADDING);
    ctx.lineTo(tooltipPos.x, height - PADDING);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(PADDING, tooltipPos.y);
    ctx.lineTo(width - PADDING, tooltipPos.y);
    ctx.stroke();

    ctx.setLineDash([]);

    // Tooltip background
    const date = new Date(candle.timestamp);
    const tooltipText = [
      `${date.toLocaleString()}`,
      `O: ${candle.open.toFixed(5)}`,
      `H: ${candle.high.toFixed(5)}`,
      `L: ${candle.low.toFixed(5)}`,
      `C: ${candle.close.toFixed(5)}`,
    ];

    const textWidth = 180;
    const textHeight = tooltipText.length * 18 + 10;
    let tooltipX = tooltipPos.x + 10;
    let tooltipY = tooltipPos.y - textHeight - 10;

    // Keep tooltip in bounds
    if (tooltipX + textWidth > width - PADDING) {
      tooltipX = tooltipPos.x - textWidth - 10;
    }
    if (tooltipY < PADDING) {
      tooltipY = tooltipPos.y + 10;
    }

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.fillRect(tooltipX, tooltipY, textWidth, textHeight);
    ctx.strokeRect(tooltipX, tooltipY, textWidth, textHeight);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'left';

    tooltipText.forEach((text, i) => {
      ctx.fillText(text, tooltipX + 8, tooltipY + 18 + i * 18);
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setTooltipPos({ x, y });

    // Find hovered candle
    const candleIndex = Math.floor((x - PADDING + scrollOffset) / (CANDLE_WIDTH + CANDLE_SPACING));
    if (candleIndex >= 0 && candleIndex < candles.length) {
      setHoveredCandle(candles[candleIndex]);
    }
  };

  const handleMouseLeave = () => {
    setHoveredCandle(null);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const newScale = Math.max(0.5, Math.min(3, scale - e.deltaY * 0.001));
      setScale(newScale);
    } else {
      // Scroll
      const newOffset = Math.max(0, scrollOffset + e.deltaX);
      setScrollOffset(newOffset);
    }
  };

  return (
    <div ref={containerRef} className="w-full h-full relative bg-chart-background overflow-hidden">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        className="cursor-crosshair"
      />
      <div className="absolute bottom-2 right-2 text-xs text-slate-500 bg-dark-800 px-2 py-1 rounded">
        Scroll to pan • Ctrl+Wheel to zoom
      </div>
    </div>
  );
};

export default CandleChart;
