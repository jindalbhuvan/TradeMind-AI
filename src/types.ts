/**
 * TradeMind AI TypeScript Types
 */

export enum TradeDirection {
  BUY = "Buy",
  SELL = "Sell"
}

export enum InstrumentType {
  EQUITY = "Equity",
  FUTURES = "Futures",
  OPTIONS = "Options"
}

export enum ConfidenceLevel {
  LOW = "Low",
  MEDIUM = "Medium",
  HIGH = "High"
}

export enum EmotionType {
  CALM = "Calm",
  FEAR = "Fear",
  REVENGE = "Revenge Trading",
  FOMO = "Over Excited",
  NEUTRAL = "Neutral"
}

export interface Trade {
  id: string;
  stockName: string;
  stockSymbol: string;
  direction: TradeDirection;
  timeFrame: string; // e.g., "5m", "15m", "1h", "Daily"
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  stopLoss?: number;
  target?: number;
  tradeDate: string; // YYYY-MM-DD
  tradeTime: string; // HH:MM
  strategyUsed: string;
  reasonForTrade: string;
  confidenceLevel: ConfidenceLevel;
  notes?: string;
  pnl: number; // Positive for profit, negative for loss
  holdingTimeMinutes?: number; // Holding duration in minutes
  emotion?: EmotionType;
  isin?: string;
  exchange?: string;
  orderId?: string;
  orderStatus?: string;
  clientName?: string;
  clientId?: string;
  
  // F&O Fields
  instrumentType?: InstrumentType;
  underlying?: string;
  expiryDate?: string;
  optionType?: "CE" | "PE";
  strikePrice?: number;
  lotSize?: number;
  numLots?: number;
}

export interface TradingProfile {
  totalTrades: number;
  winRate: number; // e.g. 58 (%)
  netProfit: number;
  avgProfit: number;
  avgLoss: number;
  avgRiskReward: number; // e.g. 1.8
  avgHoldingTimeMinutes: number;
  largestProfit: number;
  largestLoss: number;
  winningStreak: number;
  losingStreak: number;
  
  // Client Info Metadata
  clientName?: string;
  clientId?: string;
  periodFrom?: string;
  periodTo?: string;
  
  // Lists for charting
  monthlyPnL: { month: string; pnl: number }[]; // e.g., "Jan", "Feb"
  dayOfWeekPnL: { day: string; pnl: number; count: number }[]; // e.g., "Monday"
  hourlyPnL: { hour: string; pnl: number; count: number }[]; // e.g., "09:00", "10:00"
  strategyPnL: { strategy: string; pnl: number; winRate: number; count: number }[];
  reasonPnL: { reason: string; pnl: number; winRate: number; count: number }[];
  emotionPnL: { emotion: string; pnl: number; count: number }[];
  
  // Behavioral Insights
  bestTradingDay: string;
  worstTradingDay: string;
  bestTradingHour: string;
  worstTradingHour: string;
  mostSuccessfulStrategy: string;
  leastSuccessfulStrategy: string;
  frequentMistake: string;
  frequentSuccess: string;
  behaviorSummary: string;

  // F&O Additions
  equityWinRate?: number;
  futuresWinRate?: number;
  optionsWinRate?: number;
  bestInstrument?: string;
  worstInstrument?: string;
  bestExpiryType?: string;
  bestOptionType?: string;
}

export interface NewTradeAnalysisRequest {
  stockName: string;
  stockSymbol: string;
  direction: TradeDirection;
  timeFrame: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  stopLoss?: number;
  target?: number;
  tradeDate: string;
  tradeTime: string;
  strategyUsed: string;
  reasonForTrade: string;
  confidenceLevel: ConfidenceLevel;
  notes?: string;
}

export interface NewTradeAnalysisResponse {
  tradeScore: number; // 0 to 100
  verdict: "Good Trade" | "Think Again" | "Avoid This Trade";
  matchWinningPatternPercent: number; // 0 to 100
  emotionDetected: EmotionType;
  mainReasonType: string; // e.g., "FOMO", "Strategy Based", "Greed", etc.
  riskLevel: "Low" | "Medium" | "High";
  confidenceRating: "Low" | "Medium" | "High";
  recommendation: string; // e.g., "Reduce position size", "Proceed Carefully"
  whyDecisionReached: string; // detailed natural language analysis from trading psychologist
  behavioralRiskFlags: {
    overtrading: boolean;
    revengeTrading: boolean;
    fomo: boolean;
    earlyExitRisk: boolean;
    removingStopLossRisk: boolean;
  };
}
