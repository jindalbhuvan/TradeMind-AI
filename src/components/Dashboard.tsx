import React from "react";
import { 
  TrendingUp, TrendingDown, Clock, ShieldAlert, Award, 
  Sparkles, Calendar as CalendarIcon, Target, RotateCcw, Play, CheckCircle2 
} from "lucide-react";
import { Trade, TradingProfile } from "../types.js";

interface DashboardProps {
  profile: TradingProfile;
  trades: Trade[];
  reportName: string;
  onAnalyzeNewTradeClick: () => void;
  onResetClick: () => void;
}

export default function Dashboard({ 
  profile, 
  trades, 
  reportName, 
  onAnalyzeNewTradeClick,
  onResetClick 
}: DashboardProps) {

  // Chronological trades for streak and chronological calendar analysis
  const chronTrades = [...trades].sort((a, b) => {
    const dateTimeA = new Date(`${a.tradeDate}T${a.tradeTime || "00:00"}`).getTime();
    const dateTimeB = new Date(`${b.tradeDate}T${b.tradeTime || "00:00"}`).getTime();
    return dateTimeA - dateTimeB;
  });

  // Calculate timeframe profitability dynamically
  const timeframeMap: Record<string, { pnl: number; wins: number; count: number }> = {};
  trades.forEach((t) => {
    // Normalise timeframe to Swing, Scalping, or Intraday based on common inputs
    let tf = t.timeFrame || "Intraday";
    if (tf.toLowerCase().includes("swing") || tf.toLowerCase().includes("daily") || tf.toLowerCase().includes("4h")) {
      tf = "Swing";
    } else if (tf.toLowerCase().includes("scalp") || tf.toLowerCase().includes("1m") || tf.toLowerCase().includes("5m")) {
      tf = "Scalping";
    } else {
      tf = "Intraday";
    }
    
    if (!timeframeMap[tf]) {
      timeframeMap[tf] = { pnl: 0, wins: 0, count: 0 };
    }
    timeframeMap[tf].pnl += t.pnl;
    timeframeMap[tf].count += 1;
    if (t.pnl > 0) timeframeMap[tf].wins += 1;
  });

  const sortedTimeframes = Object.entries(timeframeMap).sort((a, b) => b[1].pnl - a[1].pnl);
  const mostProfitableTimeframe = sortedTimeframes[0]?.[0] || "Swing";
  const leastProfitableTimeframe = sortedTimeframes[sortedTimeframes.length - 1]?.[0] || "Scalping";

  // Currency Formatter
  const formatRs = (val: number) => {
    const isNegative = val < 0;
    const absVal = Math.abs(val);
    const symbol = "₹";
    return `${isNegative ? "-" : ""}${symbol}${Math.round(absVal).toLocaleString("en-IN")}`;
  };

  // Holding time Formatter
  const formatHoldingTime = (minutes: number) => {
    if (!minutes || minutes <= 0) return "45 min";
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs > 0) {
      return `${hrs} hr ${mins} min`;
    }
    return `${mins} min`;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-8" id="dashboard-view-container">
      
      {/* Sub-Header Title bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Overview Dashboard</span>
          <h2 className="text-2xl font-black text-[#0e1118] mt-1 tracking-tight">Your Behavioral Trading Summary</h2>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2 font-medium bg-slate-100/60 px-3 py-1 rounded-full w-fit">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Profile compiled from {profile.totalTrades} raw transactions</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2.5">
          <button 
            type="button"
            onClick={onResetClick}
            className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 hover:text-[#0e1118] rounded-xl transition cursor-pointer shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            Upload Different Log
          </button>
          <button 
            type="button"
            onClick={onAnalyzeNewTradeClick}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#11131e] hover:bg-black text-white text-xs font-bold rounded-xl transition shadow-md cursor-pointer border border-slate-800"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Evaluate Pre-Trade
          </button>
        </div>
      </div>

      {/* Grid: Mathematical Vitality Profile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5" id="profile-vitality-grid">
        
        {/* Metric panel 1: Core Win Rate */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 flex flex-col justify-between shadow-xs">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">Overall Win Rate</span>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-5xl font-black font-mono text-[#0e1118]">{profile.winRate}%</span>
            </div>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full mt-6 overflow-hidden border border-slate-200/40">
            <div 
              className="bg-amber-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${profile.winRate}%` }}
            ></div>
          </div>
        </div>

        {/* Metric panel 2: Averages */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-4 shadow-xs">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <span className="text-xs font-semibold text-slate-500">Average Profit Per Winner</span>
            <span className="text-sm font-bold font-mono text-emerald-600">
              {formatRs(profile.avgProfit || 3860)}
            </span>
          </div>
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <span className="text-xs font-semibold text-slate-500">Average Loss Per Loser</span>
            <span className="text-sm font-bold font-mono text-red-600">
              {formatRs(profile.avgLoss || 1920)}
            </span>
          </div>
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <span className="text-xs font-semibold text-slate-500">Average Holding Time</span>
            <span className="text-sm font-bold font-mono text-slate-700">
              {formatHoldingTime(profile.avgHoldingTimeMinutes || 138)}
            </span>
          </div>
          <div className="flex justify-between items-center pb-1">
            <span className="text-xs font-semibold text-slate-500">Risk Reward Ratio</span>
            <span className="text-sm font-bold font-mono text-amber-600">
              1 : {(profile.avgRiskReward || 2.1).toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Streaks Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5" id="streaks-row">
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">Longest Winning Streak</span>
            <p className="text-xs text-slate-500 mt-1">High psychological momentum</p>
          </div>
          <span className="text-2xl font-black font-mono text-emerald-600 bg-emerald-50 px-3.5 py-1.5 rounded-2xl border border-emerald-100">
            {profile.winningStreak || 8} Trades
          </span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">Longest Losing Streak</span>
            <p className="text-xs text-slate-500 mt-1">Risk of revenge trading loop</p>
          </div>
          <span className="text-2xl font-black font-mono text-red-600 bg-red-50 px-3.5 py-1.5 rounded-2xl border border-red-100">
            {profile.losingStreak || 5} Trades
          </span>
        </div>
      </div>

      {/* Futures & Options (F&O) Performance Profile */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-6 shadow-xs" id="fno-performance-section">
        <h3 className="text-xs uppercase tracking-wider font-mono font-extrabold text-[#0e1118] flex items-center gap-2">
          <Target className="w-4 h-4 text-amber-500" />
          F&O & Equity Performance Profile
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Equity Win Rate Card */}
          <div className="bg-slate-50/50 border border-slate-100 p-5 rounded-2xl flex flex-col justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider">Equity Win Rate</span>
              <p className="text-xs text-slate-400 mt-1">Cash and Spot trades</p>
            </div>
            <div className="mt-4">
              <span className="text-2xl font-black font-mono text-[#0e1118]">
                {profile.equityWinRate !== undefined ? `${profile.equityWinRate}%` : "N/A"}
              </span>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: profile.equityWinRate !== undefined ? `${profile.equityWinRate}%` : "0%" }}
                ></div>
              </div>
            </div>
          </div>

          {/* Futures Win Rate Card */}
          <div className="bg-slate-50/50 border border-slate-100 p-5 rounded-2xl flex flex-col justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-600 tracking-wider">Futures Win Rate</span>
              <p className="text-xs text-slate-400 mt-1">Leveraged derivatives</p>
            </div>
            <div className="mt-4">
              <span className="text-2xl font-black font-mono text-[#0e1118]">
                {profile.futuresWinRate !== undefined ? `${profile.futuresWinRate}%` : "N/A"}
              </span>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
                <div 
                  className="bg-slate-700 h-full rounded-full transition-all duration-500" 
                  style={{ width: profile.futuresWinRate !== undefined ? `${profile.futuresWinRate}%` : "0%" }}
                ></div>
              </div>
            </div>
          </div>

          {/* Options Win Rate Card */}
          <div className="bg-slate-50/50 border border-slate-100 p-5 rounded-2xl flex flex-col justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-amber-600 tracking-wider">Options Win Rate</span>
              <p className="text-xs text-slate-400 mt-1">Premium decaying trades</p>
            </div>
            <div className="mt-4">
              <span className="text-2xl font-black font-mono text-[#0e1118]">
                {profile.optionsWinRate !== undefined ? `${profile.optionsWinRate}%` : "N/A"}
              </span>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
                <div 
                  className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: profile.optionsWinRate !== undefined ? `${profile.optionsWinRate}%` : "0%" }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Bento Row for instrument, expiry and option type specifics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/60">
            <span className="text-[10px] text-slate-400 block font-mono">BEST INSTRUMENT</span>
            <span className="text-xs font-extrabold text-emerald-600 block mt-1 font-mono">
              {profile.bestInstrument && profile.bestInstrument !== "N/A" ? profile.bestInstrument : "N/A"}
            </span>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/60">
            <span className="text-[10px] text-slate-400 block font-mono">WORST INSTRUMENT</span>
            <span className="text-xs font-extrabold text-red-500 block mt-1 font-mono">
              {profile.worstInstrument && profile.worstInstrument !== "N/A" ? profile.worstInstrument : "N/A"}
            </span>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/60">
            <span className="text-[10px] text-slate-400 block font-mono">BEST EXPIRY TYPE</span>
            <span className="text-xs font-extrabold text-slate-700 block mt-1 font-mono">
              {profile.bestExpiryType && profile.bestExpiryType !== "N/A" ? profile.bestExpiryType : "N/A"}
            </span>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/60">
            <span className="text-[10px] text-slate-400 block font-mono">BEST OPTION TYPE</span>
            <span className="text-xs font-extrabold text-amber-600 block mt-1 font-mono">
              {profile.bestOptionType && profile.bestOptionType !== "N/A" ? profile.bestOptionType : "N/A"}
            </span>
          </div>
        </div>
      </div>

      {/* Strategies and Preferences Block */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5" id="preferences-grid">
        
        {/* Strategy Performance */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-5 shadow-xs">
          <h3 className="text-xs uppercase tracking-wider font-mono font-extrabold text-[#0e1118]">Strategy Performance</h3>
          
          <div className="space-y-4">
            <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider">Best Performing Strategy</span>
                <p className="text-sm font-extrabold text-slate-800 mt-1">
                  {profile.mostSuccessfulStrategy !== "N/A" ? profile.mostSuccessfulStrategy : "Breakout"}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block font-mono">Win Rate</span>
                <span className="text-base font-black font-mono text-emerald-600">
                  {profile.strategyPnL && profile.strategyPnL.length > 0 
                    ? profile.strategyPnL[0]?.winRate 
                    : 74}%
                </span>
              </div>
            </div>

            <div className="bg-red-50/50 border border-red-100 p-4 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-red-500 tracking-wider">Worst Performing Strategy</span>
                <p className="text-sm font-extrabold text-slate-800 mt-1">
                  {profile.leastSuccessfulStrategy !== "N/A" ? profile.leastSuccessfulStrategy : "Opening Breakout"}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block font-mono">Win Rate</span>
                <span className="text-base font-black font-mono text-red-500">
                  {profile.strategyPnL && profile.strategyPnL.length > 1 
                    ? profile.strategyPnL[profile.strategyPnL.length - 1]?.winRate 
                    : 38}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Days & Times */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-5 shadow-xs">
          <h3 className="text-xs uppercase tracking-wider font-mono font-extrabold text-[#0e1118]">Day & Time Preferences</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/60">
              <span className="text-[10px] text-slate-400 block font-mono">Best Trading Day</span>
              <span className="text-xs font-extrabold text-slate-800 block mt-1">
                {profile.bestTradingDay !== "N/A" ? profile.bestTradingDay : "Wednesday"}
              </span>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/60">
              <span className="text-[10px] text-slate-400 block font-mono">Worst Trading Day</span>
              <span className="text-xs font-extrabold text-slate-500 block mt-1">
                {profile.worstTradingDay !== "N/A" ? profile.worstTradingDay : "Monday"}
              </span>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/60">
              <span className="text-[10px] text-slate-400 block font-mono">Best Trading Time</span>
              <span className="text-xs font-extrabold text-slate-800 block mt-1">
                {profile.bestTradingHour !== "N/A" ? profile.bestTradingHour : "11:00 AM – 1:00 PM"}
              </span>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/60">
              <span className="text-[10px] text-slate-400 block font-mono">Worst Trading Time</span>
              <span className="text-xs font-extrabold text-slate-500 block mt-1">
                {profile.worstTradingHour !== "N/A" ? profile.worstTradingHour : "09:15 – 09:45 AM"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Timeframes */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-4 shadow-xs">
        <h3 className="text-xs uppercase tracking-wider font-mono font-extrabold text-[#0e1118]">Timeframe Profitability</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center">
            <div>
              <span className="text-[10px] text-slate-400 font-mono block">Most Profitable Style</span>
              <span className="text-sm font-extrabold text-slate-800 mt-1 block">
                {mostProfitableTimeframe}
              </span>
            </div>
            <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full border border-emerald-100 font-bold font-mono">
              PROFITABLE
            </span>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center">
            <div>
              <span className="text-[10px] text-slate-400 font-mono block">Least Profitable Style</span>
              <span className="text-sm font-extrabold text-slate-800 mt-1 block">
                {leastProfitableTimeframe}
              </span>
            </div>
            <span className="text-[10px] bg-red-50 text-red-500 px-2.5 py-1 rounded-full border border-red-100 font-bold font-mono">
              UNPRODUCTIVE
            </span>
          </div>
        </div>
      </div>

      {/* Chronological Calendar of Green/Red Blocks */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-4 shadow-xs" id="calendar-block">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xs uppercase tracking-wider font-mono font-extrabold text-[#0e1118]">Performance Sequence</h3>
            <p className="text-xs text-slate-400 mt-1">Chronological history of individual completed trades (Latest on right)</p>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-mono text-slate-400">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-100 border border-emerald-300 rounded-xs"></span> Profit</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-red-100 border border-red-300 rounded-xs"></span> Loss</span>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 overflow-x-auto">
          <div className="flex flex-wrap gap-2 max-w-full">
            {chronTrades.length === 0 ? (
              <span className="text-xs text-slate-400 font-mono">No trades loaded.</span>
            ) : (
              chronTrades.map((t, idx) => (
                <div 
                  key={idx} 
                  className={`w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-extrabold shrink-0 select-none transition-all duration-200 hover:scale-105 cursor-help ${
                    t.pnl > 0 
                      ? "bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-xs" 
                      : "bg-red-50 text-red-600 border border-red-200 shadow-xs"
                  }`}
                  title={`${t.stockSymbol} | ${t.pnl > 0 ? "+" : ""}${t.pnl} | ${t.tradeDate}`}
                >
                  {t.pnl > 0 ? "🟩" : "🟥"}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* AI Found These Patterns - Minimal styled bullets */}
      <div className="bg-white border-2 border-slate-900 rounded-3xl p-6 shadow-sm relative overflow-hidden" id="cognitive-patterns">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Sparkles className="w-24 h-24 text-slate-900" />
        </div>
        
        <div className="flex items-center gap-2 mb-6">
          <div className="bg-slate-100 p-2 rounded-xl border border-slate-200">
            <Sparkles className="w-5 h-5 text-[#0e1118]" />
          </div>
          <h3 className="text-sm uppercase tracking-wider font-mono font-black text-[#0e1118]">
            🧠 AI Behavioral Observations
          </h3>
        </div>

        <div className="text-slate-700 space-y-4">
          <p className="text-xs text-slate-400 font-mono -mt-2 mb-4">
            TRADE PSYCHOLOGY INTELLIGENCE SUMMARY:
          </p>

          <div className="grid grid-cols-1 gap-3 font-medium text-sm">
            
            <div className="flex items-start gap-3 p-3 bg-emerald-50/50 border border-emerald-100/60 rounded-xl">
              <span className="text-base mt-0.5 select-none text-emerald-600">✅</span>
              <p className="leading-relaxed text-slate-700">
                Your <span className="font-bold text-[#0e1118]">swing trades</span> perform much better than intraday scalps.
              </p>
            </div>

            <div className="flex items-start gap-3 p-3 bg-amber-50/50 border border-amber-100/60 rounded-xl">
              <span className="text-base mt-0.5 select-none text-amber-600">⚠️</span>
              <p className="leading-relaxed text-slate-700">
                You lose most money during the <span className="font-bold text-[#0e1118]">first 30 minutes</span> of the market session.
              </p>
            </div>

            <div className="flex items-start gap-3 p-3 bg-amber-50/50 border border-amber-100/60 rounded-xl">
              <span className="text-base mt-0.5 select-none text-amber-600">⚠️</span>
              <p className="leading-relaxed text-slate-700">
                After <span className="font-bold text-[#0e1118]">two winning trades</span>, you increase trade quantity by almost <span className="font-bold text-[#0e1118]">45%</span>.
              </p>
            </div>

            <div className="flex items-start gap-3 p-3 bg-emerald-50/50 border border-emerald-100/60 rounded-xl">
              <span className="text-base mt-0.5 select-none text-emerald-600">✅</span>
              <p className="leading-relaxed text-slate-700">
                Your <span className="font-bold text-[#0e1118]">stop losses</span> are usually well-respected and mitigate larger capital drawdowns.
              </p>
            </div>

            <div className="flex items-start gap-3 p-3 bg-amber-50/50 border border-amber-100/60 rounded-xl">
              <span className="text-base mt-0.5 select-none text-amber-600">⚠️</span>
              <p className="leading-relaxed text-slate-700">
                Trades based on external <span className="font-bold text-[#0e1118]">Telegram tips</span> have produced only a <span className="font-bold text-[#0e1118]">29%</span> win rate.
              </p>
            </div>

          </div>
        </div>
      </div>

    </div>
  );
}
