# MT5 Trading Charts

A professional-grade trading chart system inspired by MetaTrader 5 with live candle data, multiple timeframes, and WebSocket support for real-time updates.

## Features

✨ **Core Features**
- MT5-style dark theme interface
- Live candle data streaming via WebSocket
- Multiple timeframes: M1, M5, M15, M30, H1, H4
- Support for Deriv Volatility Indices and major forex pairs
- Unlimited historical candle scrolling
- Smooth zooming and panning controls
- Real-time price statistics and trend indicators

🎨 **UI/UX**
- Professional dark theme matching MT5 aesthetics
- Tailwind CSS v3 responsive design
- Smooth animations and transitions
- Interactive tooltips on hover
- Live connection status indicator

⚡ **Performance**
- TypeScript for type safety
- Efficient canvas-based chart rendering
- Optimized WebSocket communication
- Backend API for safe data fetching
- Memory-efficient candle data management

## Architecture

```
mt5-trading-charts/
├── src/
│   ├── components/
│   │   ├── CandleChart.tsx      # Canvas-based chart renderer
│   │   └── TradingChart.tsx      # Main trading chart component
│   ├── types/
│   │   └── index.ts              # TypeScript type definitions
│   ├── App.tsx                   # Main application component
│   ├── main.tsx                  # React entry point
│   ├── index.css                 # Global styles
│   └── server.ts                 # Express backend server
├── index.html                    # HTML template
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript configuration
├── tailwind.config.js            # Tailwind CSS configuration
├── vite.config.ts                # Vite build configuration
└── README.md                     # This file
```

## Getting Started

### Prerequisites
- Node.js 16+ and npm/yarn
- Git

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Mifimn/mt5-trading-charts.git
cd mt5-trading-charts
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

This will start both the frontend (Vite on `http://localhost:5173`) and backend (Express on `http://localhost:3001`).

### Build for Production

```bash
npm run build
npm run build:server
node dist/server.js
```

## API Endpoints

### REST API

#### Get Historical Candle Data
```
GET /api/candles?pair=R_10&timeframe=H1&limit=100
```

**Query Parameters:**
- `pair` (required): Trading pair symbol (e.g., R_10, EURUSD)
- `timeframe` (required): M1, M5, M15, M30, H1, H4
- `limit` (optional): Number of candles to fetch (default: 100, max: 500)

**Response:**
```json
{
  "pair": "R_10",
  "timeframe": "H1",
  "candles": [
    {
      "timestamp": 1693046400000,
      "open": 100.5432,
      "high": 101.2314,
      "low": 100.1234,
      "close": 100.8765,
      "volume": 45230.50
    }
  ]
}
```

#### Get Supported Pairs
```
GET /api/pairs
```

**Response:**
```json
[
  {
    "symbol": "R_10",
    "displayName": "Volatility 10 Index"
  },
  {
    "symbol": "R_25",
    "displayName": "Volatility 25 Index"
  }
]
```

### WebSocket API

Connect to `ws://localhost:3001/ws`

**Subscribe to Candle Updates:**
```json
{
  "type": "subscribe",
  "pair": "R_10",
  "timeframe": "H1"
}
```

**Unsubscribe:**
```json
{
  "type": "unsubscribe",
  "pair": "R_10",
  "timeframe": "H1"
}
```

**Receive Candle Updates:**
```json
{
  "type": "candle",
  "pair": "R_10",
  "timeframe": "H1",
  "data": {
    "timestamp": 1693046400000,
    "open": 100.5432,
    "high": 101.2314,
    "low": 100.1234,
    "close": 100.8765,
    "volume": 45230.50
  }
}
```

## Chart Controls

- **Mouse Movement**: Hover over candles to see detailed OHLCV data
- **Scroll**: Use mouse wheel to pan left/right through historical data
- **Zoom**: Hold `Ctrl` (or `Cmd` on Mac) and scroll to zoom in/out
- **Pair Selection**: Use the dropdown to switch between different trading pairs
- **Timeframe Selection**: Use the dropdown to change the candle timeframe

## Supported Pairs

### Deriv Volatility Indices
- R_10 - Volatility 10 Index
- R_25 - Volatility 25 Index
- R_50 - Volatility 50 Index
- R_100 - Volatility 100 Index

### Forex Pairs
- EURUSD - Euro/US Dollar
- GBPUSD - British Pound/US Dollar
- USDJPY - US Dollar/Japanese Yen
- AUDUSD - Australian Dollar/US Dollar

## Supported Timeframes

- **M1** - 1 Minute
- **M5** - 5 Minutes
- **M15** - 15 Minutes
- **M30** - 30 Minutes
- **H1** - 1 Hour
- **H4** - 4 Hours

## Technology Stack

- **Frontend:**
  - React 18
  - TypeScript
  - Tailwind CSS v3
  - Canvas API for chart rendering
  - Vite for build tooling
  - Lucide React for icons

- **Backend:**
  - Express.js
  - WebSocket (ws library)
  - TypeScript
  - Node.js

## Performance Optimizations

1. **Canvas Rendering**: Uses native canvas API for efficient chart rendering without DOM overhead
2. **Memory Management**: Keeps only 200 candles in memory, older ones are discarded
3. **Smart Subscriptions**: Only sends WebSocket updates for subscribed pairs/timeframes
4. **Lazy Loading**: Charts only render visible candles
5. **Optimized Redraws**: Canvas redraw only on data changes or viewport changes

## Development

### Project Scripts

```bash
# Start development servers (frontend + backend)
npm run dev

# Start only backend
npm run dev:server

# Start only frontend
npm run dev:client

# Build for production
npm run build

# Build backend
npm run build:server

# Type checking
npm run type-check

# Preview production build
npm run preview
```

### File Structure

- `src/server.ts` - Express backend with WebSocket server
- `src/App.tsx` - Main React component with header and selection dropdowns
- `src/components/TradingChart.tsx` - Trading chart with live updates
- `src/components/CandleChart.tsx` - Canvas-based chart renderer
- `src/types/index.ts` - TypeScript type definitions
- `src/index.css` - Global and component styles
- `src/main.tsx` - React entry point

## Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                   User Interface                        │
│  (Pair & Timeframe Selection, Chart Display)           │
└──────────────────────┬──────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
   ┌────▼──────┐              ┌──────▼──────┐
   │  REST API │              │  WebSocket  │
   │ /api/     │              │   Server    │
   │ candles   │              │  (ws://)    │
   └────┬──────┘              └──────┬──────┘
        │                             │
   Initial Load              Live Updates
   (100 candles)            (Every second)
```

## Customization

### Adding New Pairs

Edit `src/server.ts` and update the `SUPPORTED_PAIRS` array:

```typescript
const SUPPORTED_PAIRS = [
  { symbol: 'R_10', displayName: 'Volatility 10 Index' },
  { symbol: 'YOURSYMBOL', displayName: 'Your Pair Name' },
];
```

### Changing Theme Colors

Edit `tailwind.config.js` in the `colors.chart` section:

```javascript
colors: {
  chart: {
    up: '#26a69a',      // Green candles
    down: '#ef5350',    // Red candles
    neutral: '#7e8e9e', // Neutral
    background: '#0f172a', // Chart background
    grid: '#1e293b',    // Grid lines
  },
}
```

### Adjusting Chart Parameters

In `src/components/CandleChart.tsx`:

```typescript
const PADDING = 60;           // Chart padding
const CANDLE_WIDTH = 8 * scale; // Candle width
const CANDLE_SPACING = 2;     // Space between candles
```

## Troubleshooting

### WebSocket Connection Issues

1. Ensure the backend server is running on `localhost:3001`
2. Check browser console for connection errors
3. Verify CORS settings if running on different domains

### Chart Not Rendering

1. Check browser console for errors
2. Ensure canvas support in your browser
3. Verify API is returning data correctly

### Missing Candle Data

1. Adjust the `limit` query parameter to fetch more candles
2. Check if the pair/timeframe combination is valid
3. Verify backend is generating mock data correctly

## License

MIT License - feel free to use this project for commercial purposes.

## Support

For issues or feature requests, please open an issue on GitHub.

## Future Enhancements

- [ ] Connect to real broker APIs (Alpaca, Interactive Brokers)
- [ ] Add technical indicators (RSI, MACD, Moving Averages)
- [ ] Implement drawing tools (trendlines, shapes)
- [ ] Add order placement functionality
- [ ] Implement user authentication
- [ ] Add chart templates and layouts
- [ ] Support for more timeframes (W1, MN)
- [ ] Performance metrics and analytics
