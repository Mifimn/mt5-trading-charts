import express, { Express, Request, Response } from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import axios from 'axios';
import { Candle, Timeframe, ChartMessage } from './types/index.js';

const app: Express = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static('dist'));

// Store active subscriptions
const subscriptions = new Map<string, Set<string>>();

// Timeframe to seconds mapping
const timeframeToSeconds: Record<Timeframe, number> = {
  M1: 60,
  M5: 300,
  M15: 900,
  M30: 1800,
  H1: 3600,
  H4: 14400,
};

// Supported pairs (Deriv Volatility Indices)
const SUPPORTED_PAIRS = [
  { symbol: 'R_10', displayName: 'Volatility 10 Index' },
  { symbol: 'R_25', displayName: 'Volatility 25 Index' },
  { symbol: 'R_50', displayName: 'Volatility 50 Index' },
  { symbol: 'R_75', displayName: 'Volatility 75 Index' },
  { symbol: 'R_100', displayName: 'Volatility 100 Index' },
  { symbol: 'EURUSD', displayName: 'EUR/USD' },
  { symbol: 'GBPUSD', displayName: 'GBP/USD' },
  { symbol: 'USDJPY', displayName: 'USD/JPY' },
  { symbol: 'AUDUSD', displayName: 'AUD/USD' },
  { symbol: 'XAUUSD', displayName: 'Gold/USD' },
];

// API endpoint to fetch historical candle data
app.get('/api/candles', async (req: Request, res: Response) => {
  try {
    const { pair, timeframe, limit = 100 } = req.query;

    if (!pair || !timeframe) {
      return res.status(400).json({ error: 'pair and timeframe are required' });
    }

    if (!Object.keys(timeframeToSeconds).includes(timeframe as string)) {
      return res.status(400).json({ error: 'Invalid timeframe' });
    }

    // Fetch data from a reliable public API (using Finnhub or similar)
    // For Deriv indices, we'll use a mock generator that simulates realistic data
    const candles = generateMockCandles(
      pair as string,
      timeframe as Timeframe,
      parseInt(limit as string)
    );

    res.json({ pair, timeframe, candles });
  } catch (error) {
    console.error('Error fetching candles:', error);
    res.status(500).json({ error: 'Failed to fetch candle data' });
  }
});

// API endpoint to get supported pairs
app.get('/api/pairs', (req: Request, res: Response) => {
  res.json(SUPPORTED_PAIRS);
});

// WebSocket server setup
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  const clientId = Math.random().toString(36).substr(2, 9);

  ws.on('message', (data: string) => {
    try {
      const message: ChartMessage = JSON.parse(data);
      handleWebSocketMessage(clientId, message, ws);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    // Clean up subscriptions
    subscriptions.forEach((subs) => subs.delete(clientId));
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

function handleWebSocketMessage(clientId: string, message: ChartMessage, ws: any) {
  switch (message.type) {
    case 'subscribe':
      if (message.pair && message.timeframe) {
        const key = `${message.pair}:${message.timeframe}`;
        if (!subscriptions.has(key)) {
          subscriptions.set(key, new Set());
        }
        subscriptions.get(key)!.add(clientId);
        console.log(`Client ${clientId} subscribed to ${key}`);
        ws.send(JSON.stringify({ type: 'subscribed', pair: message.pair, timeframe: message.timeframe }));
      }
      break;

    case 'unsubscribe':
      if (message.pair && message.timeframe) {
        const key = `${message.pair}:${message.timeframe}`;
        subscriptions.get(key)?.delete(clientId);
        console.log(`Client ${clientId} unsubscribed from ${key}`);
      }
      break;
  }
}

// Simulate live candle updates
setInterval(() => {
  subscriptions.forEach((clientIds, key) => {
    const [pair, timeframe] = key.split(':');
    const newCandle = generateMockCandle(pair, timeframe as Timeframe);

    const message: ChartMessage = {
      type: 'candle',
      pair,
      timeframe: timeframe as Timeframe,
      data: newCandle,
    };

    clientIds.forEach((clientId) => {
      wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(JSON.stringify(message));
        }
      });
    });
  });
}, 1000); // Update every second

// Mock data generation functions
function generateMockCandles(pair: string, timeframe: Timeframe, limit: number): Candle[] {
  const candles: Candle[] = [];
  const now = Math.floor(Date.now() / 1000);
  const interval = timeframeToSeconds[timeframe];
  
  // Realistic base prices for different pairs
  const basePrice = getBasePriceForPair(pair);

  for (let i = limit; i > 0; i--) {
    const timestamp = (now - i * interval) * 1000;
    const open = basePrice + (Math.random() - 0.5) * 10;
    const close = open + (Math.random() - 0.5) * 15;
    const high = Math.max(open, close) + Math.random() * 5;
    const low = Math.min(open, close) - Math.random() * 5;
    const volume = Math.random() * 100000 + 50000;

    candles.push({
      timestamp,
      open: parseFloat(open.toFixed(5)),
      high: parseFloat(high.toFixed(5)),
      low: parseFloat(low.toFixed(5)),
      close: parseFloat(close.toFixed(5)),
      volume: parseFloat(volume.toFixed(2)),
    });
  }

  return candles;
}

function generateMockCandle(pair: string, timeframe: Timeframe): Candle {
  const timestamp = Date.now();
  const basePrice = getBasePriceForPair(pair);
  const open = basePrice + (Math.random() - 0.5) * 10;
  const close = open + (Math.random() - 0.5) * 15;
  const high = Math.max(open, close) + Math.random() * 5;
  const low = Math.min(open, close) - Math.random() * 5;
  const volume = Math.random() * 100000 + 50000;

  return {
    timestamp,
    open: parseFloat(open.toFixed(5)),
    high: parseFloat(high.toFixed(5)),
    low: parseFloat(low.toFixed(5)),
    close: parseFloat(close.toFixed(5)),
    volume: parseFloat(volume.toFixed(2)),
  };
}

// Get realistic base price for each pair
function getBasePriceForPair(pair: string): number {
  const pairPrices: Record<string, number> = {
    R_10: 150 + Math.random() * 50,
    R_25: 180 + Math.random() * 70,
    R_50: 220 + Math.random() * 80,
    R_75: 250 + Math.random() * 100,
    R_100: 300 + Math.random() * 120,
    EURUSD: 1.08 + (Math.random() - 0.5) * 0.05,
    GBPUSD: 1.27 + (Math.random() - 0.5) * 0.05,
    USDJPY: 149 + (Math.random() - 0.5) * 2,
    AUDUSD: 0.68 + (Math.random() - 0.5) * 0.02,
    XAUUSD: 2050 + (Math.random() - 0.5) * 50,
  };

  return pairPrices[pair] || 100 + Math.random() * 100;
}

server.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📊 WebSocket server ready at ws://localhost:${PORT}/ws`);
});
