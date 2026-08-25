import React, { useEffect, useRef, useState } from 'react';
import { Candle, Timeframe, ChartMessage } from '../types/index';
import CandleChart from './CandleChart';
import { ChevronDown, TrendingUp, TrendingDown } from 'lucide-react';

interface TradingChartProps {
  pair: string;
  timeframe: Timeframe;
}

const TradingChart: React.FC<TradingChartProps> = ({ pair, timeframe }) => {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [stats, setStats] = useState({ high: 0, low: 0, open: 0, close: 0 });
  const wsRef = useRef<WebSocket | null>(null);
  const subscriptionKeyRef = useRef<string>('');

  // Fetch initial candle data
  useEffect(() => {
    const fetchCandles = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/candles?pair=${pair}&timeframe=${timeframe}&limit=100`);
        if (!response.ok) throw new Error('Failed to fetch candles');

        const data = await response.json();
        setCandles(data.candles);
        updateStats(data.candles);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        console.error('Error fetching candles:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCandles();
  }, [pair, timeframe]);

  // WebSocket connection for live updates
  useEffect(() => {
    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setConnected(true);
        console.log('WebSocket connected');

        // Subscribe to the current pair and timeframe
        const subscriptionKey = `${pair}:${timeframe}`;
        subscriptionKeyRef.current = subscriptionKey;

        wsRef.current?.send(
          JSON.stringify({
            type: 'subscribe',
            pair,
            timeframe,
          })
        );
      };

      wsRef.current.onmessage = (event: MessageEvent) => {
        try {
          const message: ChartMessage = JSON.parse(event.data);

          if (message.type === 'candle' && message.data) {
            setCandles((prev) => {
              const updated = [...prev];
              // Check if we need to add or update a candle
              const lastCandle = updated[updated.length - 1];

              if (lastCandle && lastCandle.timestamp === message.data!.timestamp) {
                // Update the last candle if it's the same timestamp
                updated[updated.length - 1] = message.data!;
              } else {
                // Add new candle
                updated.push(message.data!);
                // Keep only last 200 candles in memory
                if (updated.length > 200) {
                  updated.shift();
                }
              }

              updateStats(updated);
              return updated;
            });
          }
        } catch (err) {
          console.error('Error processing WebSocket message:', err);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnected(false);
      };

      wsRef.current.onclose = () => {
        setConnected(false);
        console.log('WebSocket disconnected');
        // Attempt to reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [pair, timeframe]);

  const updateStats = (candleList: Candle[]) => {
    if (candleList.length === 0) return;

    const closes = candleList.map((c) => c.close);
    const highs = candleList.map((c) => c.high);
    const lows = candleList.map((c) => c.low);

    setStats({
      high: Math.max(...highs),
      low: Math.min(...lows),
      open: candleList[0].open,
      close: candleList[candleList.length - 1].close,
    });
  };

  const change = stats.close - stats.open;
  const changePercent = stats.open !== 0 ? (change / stats.open) * 100 : 0;
  const isPositive = change >= 0;

  return (
    <div className="w-full h-full flex flex-col bg-chart-background">
      {/* Info Bar */}
      <div className="bg-dark-800 border-b border-dark-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          {/* Price Display */}
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{stats.close.toFixed(5)}</span>
            <div className={`flex items-center gap-1 ${isPositive ? 'text-chart-up' : 'text-chart-down'}`}>
              {isPositive ? (
                <TrendingUp size={16} />
              ) : (
                <TrendingDown size={16} />
              )}
              <span className="text-sm font-semibold">
                {isPositive ? '+' : ''}{change.toFixed(5)} ({changePercent.toFixed(2)}%)
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-slate-400">H: </span>
              <span className="text-white font-semibold">{stats.high.toFixed(5)}</span>
            </div>
            <div>
              <span className="text-slate-400">L: </span>
              <span className="text-white font-semibold">{stats.low.toFixed(5)}</span>
            </div>
            <div>
              <span className="text-slate-400">O: </span>
              <span className="text-white font-semibold">{stats.open.toFixed(5)}</span>
            </div>
          </div>
        </div>

        {/* Connection Status */}
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              connected ? 'bg-chart-up animate-pulse' : 'bg-chart-down'
            }`}
          ></div>
          <span className="text-xs text-slate-400">
            {connected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Chart Area */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-dark-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-400">Loading {pair} {timeframe} chart...</p>
            </div>
          </div>
        ) : error ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-red-400 mb-2">Error loading chart</p>
              <p className="text-slate-400 text-sm">{error}</p>
            </div>
          </div>
        ) : (
          <CandleChart candles={candles} />
        )}
      </div>
    </div>
  );
};

export default TradingChart;
