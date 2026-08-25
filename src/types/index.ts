export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CandleData {
  pair: string;
  timeframe: string;
  candles: Candle[];
  lastUpdate: number;
}

export interface PairConfig {
  symbol: string;
  displayName: string;
  description?: string;
}

export type Timeframe = 'M1' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4';

export interface ChartMessage {
  type: 'subscribe' | 'unsubscribe' | 'candle' | 'error';
  pair?: string;
  timeframe?: Timeframe;
  data?: Candle;
  message?: string;
}

export interface WebSocketMessage {
  type: string;
  pair?: string;
  timeframe?: Timeframe;
  data?: Candle;
  message?: string;
}
