import React from "react";
import { BarChart3, TrendingUp, Calendar, Clock, Award } from "lucide-react";
import { TradingProfile, Trade } from "../types.js";

interface ChartsViewProps {
  profile: TradingProfile;
  trades: Trade[];
}

export default function ChartsView({ profile, trades }: ChartsViewProps) {
  
  // Format Indian Rupees helper
  const formatRs = (val: number) => {
    const isNegative = val < 0;
    const absVal = Math.abs(val);
    const symbol = "₹";
    return `${isNegative ? "-" : ""}${symbol}${Math.round(absVal).toLocaleString("en-IN")}`;
  };

  // Sort trades chronologically to build cumulative PnL
  const sortedTrades = [...trades].sort((a, b) => {
    const dateTimeA = new Date(`${a.tradeDate}T${a.tradeTime || "00:00"}`).getTime();
    const dateTimeB = new Date(`${b.tradeDate}T${b.tradeTime || "00:00"}`).getTime();
    return dateTimeA - dateTimeB;
  });

  // Calculate cumulative wealth timeline data points for Area Chart
  let cumulative = 0;
  const cumulativePoints = sortedTrades.map((t, idx) => {
    cumulative += t.pnl;
    return {
      index: idx + 1,
      pnl: cumulative,
      symbol: t.stockSymbol,
      date: t.tradeDate
    };
  });

  const maxPnL = Math.max(...cumulativePoints.map(p => p.pnl), 1);
  const minPnL = Math.min(...cumulativePoints.map(p => p.pnl), -1);
  const pnlRange = maxPnL - minPnL;

  // Render SVG Cumulative Wealth Area Chart
  const renderCumulativeAreaChart = () => {
    if (cumulativePoints.length === 0) return null;
    
    const width = 600;
    const height = 180;
    const paddingLeft = 60;
    const paddingRight = 20;
    const paddingTop = 15;
    const paddingBottom = 20;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    // Generate path
    let pointsStr = "";
    cumulativePoints.forEach((point, i) => {
      const x = paddingLeft + (i / (cumulativePoints.length - 1)) * chartWidth;
      // Normalise y
      const normY = pnlRange === 0 ? 0.5 : (point.pnl - minPnL) / pnlRange;
      const y = paddingTop + (1 - normY) * chartHeight;
      pointsStr += `${i === 0 ? "M" : "L"} ${x} ${y} `;
    });

    // Generate area path that seals at the bottom (or zero line)
    const zeroNorm = pnlRange === 0 ? 0.5 : (0 - minPnL) / pnlRange;
    const zeroY = paddingTop + Math.min(Math.max(0, 1 - zeroNorm), 1) * chartHeight;
    const areaStr = `${pointsStr} L ${paddingLeft + chartWidth} ${zeroY} L ${paddingLeft} ${zeroY} Z`;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none">
        <defs>
          <linearGradient id="wealthGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        
        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((val, idx) => {
          const y = paddingTop + val * chartHeight;
          const labelVal = maxPnL - val * pnlRange;
          return (
            <g key={idx} className="opacity-70">
              <line 
                x1={paddingLeft} 
                y1={y} 
                x2={paddingLeft + chartWidth} 
                y2={y} 
                stroke="#f1f5f9" 
                strokeWidth={1} 
                strokeDasharray="4"
              />
              <text 
                x={paddingLeft - 8} 
                y={y + 3} 
                fill="#94a3b8" 
                fontSize="9" 
                fontFamily="monospace" 
                textAnchor="end"
                className="font-medium"
              >
                {formatRs(labelVal)}
              </text>
            </g>
          );
        })}

        {/* Shaded Area */}
        <path d={areaStr} fill="url(#wealthGrad)" />

        {/* Primary Line */}
        <path d={pointsStr} fill="none" stroke="#4f46e5" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

        {/* Zero baseline */}
        <line 
          x1={paddingLeft} 
          y1={zeroY} 
          x2={paddingLeft + chartWidth} 
          y2={zeroY} 
          stroke="#f43f5e" 
          strokeWidth={1.5} 
          strokeDasharray="2" 
          className="opacity-50"
        />

        {/* Date labels bottom */}
        {cumulativePoints.length > 1 && [0, Math.floor(cumulativePoints.length / 2), cumulativePoints.length - 1].map((idx, i) => {
          const x = paddingLeft + (idx / (cumulativePoints.length - 1)) * chartWidth;
          const alignment = i === 0 ? "start" : i === 1 ? "middle" : "end";
          return (
            <text 
              key={i} 
              x={x} 
              y={height - 2} 
              fill="#94a3b8" 
              fontSize="9" 
              fontFamily="monospace" 
              textAnchor={alignment}
              className="font-medium"
            >
              {cumulativePoints[idx]?.date}
            </text>
          );
        })}
      </svg>
    );
  };

  // Render Horizontal Strategy Bar Chart
  const renderStrategyBarChart = () => {
    const data = profile.strategyPnL || [];
    if (data.length === 0) return <div className="text-xs text-slate-400 font-mono">No strategy metrics.</div>;

    const maxVal = Math.max(...data.map(d => Math.abs(d.pnl)), 1);

    return (
      <div className="space-y-4">
        {data.map((item, idx) => {
          const widthPercent = Math.min(100, (Math.abs(item.pnl) / maxVal) * 100);
          const isProfit = item.pnl >= 0;
          
          return (
            <div key={idx} className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-[#0e1118] font-bold">{item.strategy}</span>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400">WR: <span className="text-indigo-600 font-bold">{item.winRate}%</span></span>
                  <span className={isProfit ? "text-emerald-600 font-black" : "text-rose-600 font-black"}>
                    {isProfit ? "+" : ""}{formatRs(item.pnl)}
                  </span>
                </div>
              </div>
              <div className="w-full bg-slate-50 border border-slate-100 h-3.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${isProfit ? "bg-emerald-500" : "bg-rose-500"}`}
                  style={{ width: `${widthPercent}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render Day of Week Vertical Columns
  const renderDayOfWeekChart = () => {
    const data = profile.dayOfWeekPnL || [];
    if (data.length === 0) return <div className="text-xs text-slate-400 font-mono">No weekday metrics.</div>;

    const maxVal = Math.max(...data.map(d => Math.abs(d.pnl)), 1);

    return (
      <div className="grid grid-cols-5 gap-3 h-44 items-end pt-6 font-mono text-xs">
        {data.map((item, idx) => {
          const heightPercent = Math.min(90, (Math.abs(item.pnl) / maxVal) * 100);
          const isProfit = item.pnl >= 0;
          return (
            <div key={idx} className="flex flex-col items-center justify-end h-full group">
              <span className={`text-[9px] font-black opacity-0 group-hover:opacity-100 transition duration-150 mb-1 ${
                isProfit ? "text-emerald-600" : "text-rose-600"
              }`}>
                {isProfit ? "+" : ""}{Math.round(item.pnl / 1000)}k
              </span>
              <div 
                className={`w-full rounded-t-md transition-all duration-300 ${
                  isProfit 
                    ? "bg-gradient-to-t from-emerald-400/20 to-emerald-500 hover:brightness-95" 
                    : "bg-gradient-to-t from-rose-400/20 to-rose-500 hover:brightness-95"
                }`}
                style={{ height: `${heightPercent || 10}%` }}
                title={`${item.day}: ${formatRs(item.pnl)} (${item.count} trades)`}
              ></div>
              <span className="text-[10px] text-slate-500 mt-2 font-bold uppercase tracking-wider">
                {item.day.slice(0, 3)}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8" id="charts-view-container">
      
      {/* Header */}
      <div className="border-b border-slate-100 pb-6 text-center md:text-left">
        <h1 className="text-2xl font-black text-[#0e1118] tracking-tight flex items-center justify-center md:justify-start gap-2">
          <BarChart3 className="w-6 h-6 text-indigo-600" />
          Aesthetic Performance Charts
        </h1>
        <p className="text-xs text-slate-400 mt-1 font-mono uppercase tracking-wider">
          MATHEMATICAL & BEHAVIORAL VISUALISATIONS
        </p>
      </div>

      {/* Grid: Cumulative Profit Curve */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-[#0e1118] uppercase tracking-wider font-mono">
              Cumulative Wealth Curve
            </h2>
          </div>
          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider font-semibold">Equity Timeline (Latest on the right)</span>
        </div>
        
        <div className="bg-slate-50/50 border border-slate-100/50 rounded-2xl p-4 md:p-6">
          {renderCumulativeAreaChart()}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Day of Week PnL */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Calendar className="w-4 h-4 text-purple-600" />
            <h2 className="text-sm font-bold text-[#0e1118] uppercase tracking-wider font-mono">
              Yield by Day of Week
            </h2>
          </div>
          {renderDayOfWeekChart()}
        </div>

        {/* Strategy Performance */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Award className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-bold text-[#0e1118] uppercase tracking-wider font-mono">
              Yield by Strategy
            </h2>
          </div>
          {renderStrategyBarChart()}
        </div>

      </div>

    </div>
  );
}
