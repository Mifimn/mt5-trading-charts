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

// Store cached candles to avoid excessive API calls
const candleCache = new Map<string, { candles: Candle[]; timestamp: number }>();

// Timeframe to seconds mapping
const timeframeToSeconds: Record<Timeframe, number> = {
  M1: 60,
  M5: 300,
  M15: 900,
  M30: 1800,
  H1: 3600,
  H4: 14400,
};

// Deriv API ticks buffer for building candles
const ticksBuffer = new Map<string, any[]>();

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

// Deriv API WebSocket connection
let derivWs: WebSocket | null = null;
const derivSubscriptions = new Map<string, { req_id: number; pair: string; timeframe: Timeframe }>();
let nextReqId = 1;

// Initialize Deriv WebSocket connection
function initDerivConnection() {
  try {
    derivWs = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');

    derivWs.onopen = () => {
      console.log('✅ Connected to Deriv API');
      // Authorize with app_id (or token if you have one)
      derivWs?.send(
        JSON.stringify({
          authorize: 'AQIC3xDTMSJySEQoK1KSwPFZSXvfJK_Mdu6yzGFnWQk2AoI',
        })
      );
    };

    derivWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.authorize) {
          console.log('✅ Deriv API authorized');
        }

        if (data.candles) {
          handleDerivCandles(data);
        }

        if (data.tick) {
          handleDerivTick(data);
        }
      } catch (error) {
        console.error('Error processing Deriv message:', error);
      }
    };

    derivWs.onerror = (error) => {
      console.error('Deriv WebSocket error:', error);
    };

    derivWs.onclose = () => {
      console.log('❌ Deriv WebSocket disconnected');
      // Attempt to reconnect after 5 seconds
      setTimeout(initDerivConnection, 5000);
    };
  } catch (error) {
    console.error('Error initializing Deriv connection:', error);
    setTimeout(initDerivConnection, 5000);
  }
}

function handleDerivCandles(data: any) {
  if (data.candles && Array.isArray(data.candles)) {
    const candles: Candle[] = data.candles.map((c: any) => ({
      timestamp: c.epoch * 1000,
      open: parseFloat(c.open),
      high: parseFloat(c.high),
      low: parseFloat(c.low),
      close: parseFloat(c.close),
      volume: c.tick_count || 0,
    }));

    // Find which subscription this is for
    const subscription = Array.from(derivSubscriptions.values()).find((s) => s.req_id === data.req_id);

    if (subscription) {
      const cacheKey = `${subscription.pair}:${subscription.timeframe}`;
      candleCache.set(cacheKey, { candles, timestamp: Date.now() });

      // Broadcast to all connected clients
      broadcastToClients({
        type: 'candles_update',
        pair: subscription.pair,
        timeframe: subscription.timeframe,
        candles,
      });
    }
  }
}

function handleDerivTick(data: any) {
  if (data.tick) {
    const tick = data.tick;
    const pair = tick.symbol;

    if (!ticksBuffer.has(pair)) {
      ticksBuffer.set(pair, []);
    }

    ticksBuffer.get(pair)!.push({
      timestamp: tick.epoch * 1000,
      price: parseFloat(tick.quote),
    });

    // Keep only recent ticks
    const buffer = ticksBuffer.get(pair)!;
    if (buffer.length > 1000) {
      buffer.shift();
    }
  }
}

function broadcastToClients(message: any) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(message));
    }
  });
}

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

    const cacheKey = `${pair}:${timeframe}`;
    const cached = candleCache.get(cacheKey);

    // Use cache if available and fresh (within 5 minutes)
    if (cached && Date.now() - cached.timestamp < 300000) {
      const candles = cached.candles.slice(-parseInt(limit as string));
      return res.json({ pair, timeframe, candles, source: 'cache' });
    }

    // Fetch from Deriv API
    const candles = await fetchFromDerivAPI(pair as string, timeframe as Timeframe, parseInt(limit as string));

    if (candles.length > 0) {
      candleCache.set(cacheKey, { candles, timestamp: Date.now() });
      return res.json({ pair, timeframe, candles, source: 'deriv' });
    } else {
      // Fallback to mock data if API fails
      console.warn(`No real data for ${pair}, using mock data`);
      const mockCandles = generateMockCandles(pair as string, timeframe as Timeframe, parseInt(limit as string));
      return res.json({ pair, timeframe, candles: mockCandles, source: 'mock' });
    }
  } catch (error) {
    console.error('Error fetching candles:', error);
    res.status(500).json({ error: 'Failed to fetch candle data' });
  }
});

// Fetch candles from Deriv API
async function fetchFromDerivAPI(pair: string, timeframe: Timeframe, limit: number): Promise<Candle[]> {
  return new Promise((resolve) => {
    if (!derivWs || derivWs.readyState !== 1) {
      console.warn('Deriv WebSocket not connected, using mock data');
      resolve([]);
      return;
    }

    const req_id = nextReqId++;
    const granularity = timeframeToSeconds[timeframe];

    // Map symbol if needed
    const derivSymbol = mapToDeriVSymbol(pair);

    const request = {
      ticks_history: derivSymbol,
      adjust_start_time: 1,
      count: limit,
      end: 'latest',
      start: 1,
      style: 'candles',
      granularity: granularity,
      req_id: req_id,
    };

    // Timeout after 10 seconds
    const timeout = setTimeout(() => {
      console.warn(`Deriv API request ${req_id} timed out`);
      resolve([]);
    }, 10000);

    // Store subscription temporarily to handle response
    derivSubscriptions.set(`temp_${req_id}`, { req_id, pair, timeframe });

    // Listen for response
    const originalOnMessage = derivWs!.onmessage;
    derivWs!.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.req_id === req_id && data.candles) {
          clearTimeout(timeout);
          derivSubscriptions.delete(`temp_${req_id}`);

          const candles: Candle[] = data.candles.map((c: any) => ({
            timestamp: c.epoch * 1000,
            open: parseFloat(c.open),
            high: parseFloat(c.high),
            low: parseFloat(c.low),
            close: parseFloat(c.close),
            volume: c.tick_count || 0,
          }));

          resolve(candles);
        }
      } catch (error) {
        console.error('Error parsing Deriv response:', error);
      }
    };

    derivWs!.send(JSON.stringify(request));
  });
}

// Map trading symbols to Deriv symbols
function mapToDeriVSymbol(symbol: string): string {
  const symbolMap: Record<string, string> = {
    R_10: 'R_10',
    R_25: 'R_25',
    R_50: 'R_50',
    R_75: 'R_75',
    R_100: 'R_100',
    EURUSD: 'frxEURUSD',
    GBPUSD: 'frxGBPUSD',
    USDJPY: 'frxUSDJPY',
    AUDUSD: 'frxAUDUSD',
    XAUUSD: 'XAUUSD',
  };

  return symbolMap[symbol] || symbol;
}

// API endpoint to get supported pairs
app.get('/api/pairs', (req: Request, res: Response) => {
  res.json(SUPPORTED_PAIRS);
});

// WebSocket server setup
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  console.log('📱 WebSocket client connected');
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
    console.log('🔌 WebSocket client disconnected');
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
        console.log(`👤 Client ${clientId} subscribed to ${key}`);

        // Send initial data from cache if available
        const cached = candleCache.get(key);
        if (cached) {
          ws.send(JSON.stringify({ type: 'initial_candles', pair: message.pair, timeframe: message.timeframe, candles: cached.candles }));
        }

        ws.send(JSON.stringify({ type: 'subscribed', pair: message.pair, timeframe: message.timeframe }));
      }
      break;

    case 'unsubscribe':
      if (message.pair && message.timeframe) {
        const key = `${message.pair}:${message.timeframe}`;
        subscriptions.get(key)?.delete(clientId);
        console.log(`👤 Client ${clientId} unsubscribed from ${key}`);
      }
      break;
  }
}

// Simulate live candle updates from cached data
setInterval(() => {
  subscriptions.forEach((clientIds, key) => {
    const cached = candleCache.get(key);
    if (cached && cached.candles.length > 0) {
      const lastCandle = cached.candles[cached.candles.length - 1];

      // Simulate slight price changes
      const variation = (Math.random() - 0.5) * (lastCandle.close * 0.001);
      const updatedCandle = {
        ...lastCandle,
        close: parseFloat((lastCandle.close + variation).toFixed(5)),
        high: parseFloat(Math.max(lastCandle.high, lastCandle.close + variation).toFixed(5)),
        low: parseFloat(Math.min(lastCandle.low, lastCandle.close + variation).toFixed(5)),
      };

      const [pair, timeframe] = key.split(':');
      const message: ChartMessage = {
        type: 'candle',
        pair,
        timeframe: timeframe as Timeframe,
        data: updatedCandle,
      };

      broadcastToClients(message);
    }
  });
}, 1000); // Update every second

// Fallback mock data generation (for when API fails)
function generateMockCandles(pair: string, timeframe: Timeframe, limit: number): Candle[] {
  const candles: Candle[] = [];
  const now = Math.floor(Date.now() / 1000);
  const interval = timeframeToSeconds[timeframe];
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

// Initialize Deriv connection on startup
initDerivConnection();

server.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📊 WebSocket server ready at ws://localhost:${PORT}/ws`);
  console.log(`🔗 Deriv API connection initializing...`);
});
