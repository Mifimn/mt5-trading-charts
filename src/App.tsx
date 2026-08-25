import React, { useState, useEffect } from 'react';
import TradingChart from './components/TradingChart';
import { PairConfig, Timeframe } from './types/index';

const App: React.FC = () => {
  const [pairs, setPairs] = useState<PairConfig[]>([]);
  const [selectedPair, setSelectedPair] = useState<string>('R_10');
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('H1');
  const [loading, setLoading] = useState(true);

  const timeframes: Timeframe[] = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4'];

  useEffect(() => {
    const fetchPairs = async () => {
      try {
        const response = await fetch('/api/pairs');
        const data = await response.json();
        setPairs(data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching pairs:', error);
        setLoading(false);
      }
    };

    fetchPairs();
  }, []);

  return (
    <div className="w-full h-screen bg-dark-900 flex flex-col text-slate-200">
      {/* Header */}
      <div className="bg-dark-800 border-b border-dark-700 px-4 py-4">
        <div className="max-w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded flex items-center justify-center">
              <span className="text-white font-bold text-sm">MT5</span>
            </div>
            <h1 className="text-xl font-bold text-white">Trading Charts</h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Pair Selector */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400 uppercase tracking-wider">Pair</label>
              <select
                value={selectedPair}
                onChange={(e) => setSelectedPair(e.target.value)}
                className="bg-dark-700 border border-dark-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 hover:border-dark-500 cursor-pointer"
              >
                {pairs.map((pair) => (
                  <option key={pair.symbol} value={pair.symbol}>
                    {pair.displayName}
                  </option>
                ))}
              </select>
            </div>

            {/* Timeframe Selector */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400 uppercase tracking-wider">Timeframe</label>
              <select
                value={selectedTimeframe}
                onChange={(e) => setSelectedTimeframe(e.target.value as Timeframe)}
                className="bg-dark-700 border border-dark-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 hover:border-dark-500 cursor-pointer"
              >
                {timeframes.map((tf) => (
                  <option key={tf} value={tf}>
                    {tf}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Container */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-dark-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-400">Loading chart data...</p>
            </div>
          </div>
        ) : (
          <TradingChart pair={selectedPair} timeframe={selectedTimeframe} />
        )}
      </div>
    </div>
  );
};

export default App;
