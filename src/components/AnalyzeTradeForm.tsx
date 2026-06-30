import React, { useState } from "react";
import { 
  ArrowLeft, Brain, Sparkles, CheckCircle, AlertTriangle, 
  Ban, Star, Shield, HelpCircle, Flame, CheckCircle2, ChevronRight, RefreshCcw
} from "lucide-react";
import { Trade, TradeDirection, ConfidenceLevel, EmotionType, NewTradeAnalysisResponse, TradingProfile, InstrumentType } from "../types.js";

interface AnalyzeTradeFormProps {
  profile: TradingProfile;
  onSubmit: (trade: any) => Promise<NewTradeAnalysisResponse>;
  onCancel: () => void;
  isLoading: boolean;
}

export default function AnalyzeTradeForm({ profile, onSubmit, onCancel, isLoading: parentIsLoading }: AnalyzeTradeFormProps) {
  const [formData, setFormData] = useState({
    instrumentType: "Equity", // Equity, Futures, Options
    stockName: "TCS",
    stockSymbol: "TCS",
    underlying: "NIFTY",
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // default 30 days from now
    lotSize: "25",
    numLots: "1",
    strikePrice: "24000",
    optionType: "CE", // CE or PE
    timeFrame: "Intraday", // Intraday vs Swing
    entryPrice: "3565",
    quantity: "100",
    stopLoss: "3525",
    target: "3640",
    tradeDate: new Date().toISOString().split("T")[0],
    tradeTime: "10:42",
    reasonForTrade: "Technical Analysis",
    strategyUsed: "Breakout",
  });

  const [confidenceStars, setConfidenceStars] = useState(4); // default 4 stars: ⭐⭐⭐⭐☆
  const [loadingStep, setLoadingStep] = useState(0);
  const [analysis, setAnalysis] = useState<NewTradeAnalysisResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lists requested by the user
  const reasons = [
    "Technical Analysis",
    "Company News",
    "Economic News",
    "Personal Research",
    "Telegram Tip",
    "Friend Recommendation",
    "Everyone is Buying",
    "Recover Previous Loss",
    "Social Media",
    "Other"
  ];

  const strategies = [
    "Breakout",
    "Pullback",
    "Price Action",
    "Moving Average",
    "Momentum",
    "Support Resistance",
    "VWAP",
    "Other"
  ];

  const getAutoLotSize = (underlying: string): string => {
    const ul = underlying.toUpperCase().trim();
    if (ul.includes("BANKNIFTY") || ul.includes("BANK")) return "15";
    if (ul.includes("NIFTY")) return "25";
    if (ul.includes("FINNIFTY")) return "40";
    if (ul.includes("SENSEX")) return "10";
    if (ul.includes("RELIANCE")) return "250";
    if (ul.includes("TCS")) return "175";
    if (ul.includes("INFY")) return "400";
    return "50"; // default fallback
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const next = { ...prev, [name]: value };
      if (name === "underlying") {
        next.lotSize = getAutoLotSize(value);
      }
      return next;
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setLoadingStep(1);

    // Multi-step sequential progress messages exactly as requested
    const timer1 = setTimeout(() => setLoadingStep(2), 1200);
    const timer2 = setTimeout(() => setLoadingStep(3), 2400);

    try {
      // Map confidence stars to ConfidenceLevel enum
      let mappedConfidence = ConfidenceLevel.MEDIUM;
      if (confidenceStars <= 2) mappedConfidence = ConfidenceLevel.LOW;
      else if (confidenceStars >= 5) mappedConfidence = ConfidenceLevel.HIGH;

      let tradeObj: any = {
        direction: TradeDirection.BUY, // assume Buy by default for evaluating entries
        timeFrame: formData.timeFrame,
        entryPrice: Number(formData.entryPrice) || 0,
        exitPrice: Number(formData.target) || 0, // Target/Exit Price
        stopLoss: formData.stopLoss ? Number(formData.stopLoss) : undefined,
        target: formData.target ? Number(formData.target) : undefined,
        tradeDate: formData.tradeDate,
        tradeTime: formData.tradeTime,
        reasonForTrade: formData.reasonForTrade,
        strategyUsed: formData.strategyUsed,
        confidenceLevel: mappedConfidence,
        notes: `User selected ${confidenceStars} stars confidence. Mode: ${formData.instrumentType}.`
      };

      if (formData.instrumentType === "Equity") {
        tradeObj.stockName = formData.stockName;
        tradeObj.stockSymbol = formData.stockSymbol;
        tradeObj.quantity = Math.max(1, Number(formData.quantity) || 1);
        tradeObj.instrumentType = InstrumentType.EQUITY;
      } else if (formData.instrumentType === "Futures") {
        tradeObj.stockName = `${formData.underlying} Futures`;
        tradeObj.stockSymbol = `${formData.underlying} FUT`;
        const size = Number(formData.lotSize) || 1;
        const lots = Number(formData.numLots) || 1;
        tradeObj.quantity = size * lots;
        tradeObj.instrumentType = InstrumentType.FUTURES;
        tradeObj.underlying = formData.underlying;
        tradeObj.expiryDate = formData.expiryDate;
        tradeObj.lotSize = size;
        tradeObj.numLots = lots;
      } else {
        // Options
        tradeObj.stockName = `${formData.underlying} ${formData.strikePrice} ${formData.optionType}`;
        tradeObj.stockSymbol = `${formData.underlying} ${formData.strikePrice}${formData.optionType}`;
        const size = Number(formData.lotSize) || 1;
        const lots = Number(formData.numLots) || 1;
        tradeObj.quantity = size * lots;
        tradeObj.instrumentType = InstrumentType.OPTIONS;
        tradeObj.underlying = formData.underlying;
        tradeObj.expiryDate = formData.expiryDate;
        tradeObj.optionType = formData.optionType;
        tradeObj.strikePrice = Number(formData.strikePrice) || 0;
        tradeObj.lotSize = size;
        tradeObj.numLots = lots;
      }

      const result = await onSubmit(tradeObj);
      setAnalysis(result);
    } catch (error) {
      console.error(error);
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setIsSubmitting(false);
      setLoadingStep(0);
    }
  };

  // Convert tradeScore or verdict to visual colors
  const getDecisionColor = (score: number, type: "text" | "bg" | "border") => {
    if (score >= 75) {
      if (type === "text") return "text-emerald-600";
      if (type === "bg") return "bg-emerald-50";
      return "border-emerald-200";
    } else if (score >= 50) {
      if (type === "text") return "text-amber-600";
      if (type === "bg") return "bg-amber-50";
      return "border-amber-200";
    } else {
      if (type === "text") return "text-rose-600";
      if (type === "bg") return "bg-rose-50";
      return "border-rose-200";
    }
  };

  return (
    <div className="max-w-xl mx-auto py-8 px-4" id="analyze-new-trade-form-view">
      
      {/* 1. ANIMATION SCREEN: Analyzing, Comparing, Finding */}
      {isSubmitting && (
        <div className="bg-white border border-slate-100 rounded-3xl p-10 text-center shadow-xl flex flex-col items-center justify-center min-h-[450px]" id="evaluation-animation-card">
          <div className="relative mb-8">
            <div className="w-20 h-20 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
            <Brain className="w-9 h-9 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          
          <h2 className="text-2xl font-black text-[#0e1118] mb-6 tracking-tight">Analyzing Trade Setup</h2>
          
          <div className="space-y-4 max-w-sm w-full font-mono text-sm">
            <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 ${
              loadingStep >= 1 ? "bg-indigo-50 border-indigo-100 text-indigo-600" : "bg-transparent border-slate-100 text-slate-400"
            }`}>
              <span className="text-xs font-bold">{loadingStep >= 1 ? "●" : "○"}</span>
              <span className={loadingStep === 1 ? "animate-pulse font-bold" : ""}>Analyzing...</span>
            </div>

            <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 ${
              loadingStep >= 2 ? "bg-purple-50 border-purple-100 text-purple-600" : "bg-transparent border-slate-100 text-slate-400"
            }`}>
              <span className="text-xs font-bold">{loadingStep >= 2 ? "●" : "○"}</span>
              <span className={loadingStep === 2 ? "animate-pulse font-bold" : ""}>
                Comparing with {profile.totalTrades} historical trades...
              </span>
            </div>

            <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 ${
              loadingStep >= 3 ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-transparent border-slate-100 text-slate-400"
            }`}>
              <span className="text-xs font-bold">{loadingStep >= 3 ? "●" : "○"}</span>
              <span className={loadingStep === 3 ? "animate-pulse font-bold" : ""}>Finding similar trades...</span>
            </div>
          </div>

          <p className="text-xs text-slate-400 mt-10 font-mono uppercase tracking-wider">
            Checking psychological indicators and bias markers...
          </p>
        </div>
      )}

      {/* 2. RESULTS SCREEN: The beautiful card as requested */}
      {!isSubmitting && analysis && (
        <div className="space-y-6" id="analysis-results-card">
          
          {/* Header Action Row */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setAnalysis(null)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#0e1118] transition font-semibold cursor-pointer font-mono"
            >
              <ArrowLeft className="w-4 h-4" />
              Analyze Another Trade
            </button>
            <span className="text-xs text-slate-400 font-mono">ID: {formData.stockSymbol}-{formData.tradeTime}</span>
          </div>

          {/* Premium AI Report Card */}
          <div className="bg-white border border-slate-100 rounded-3xl p-6 md:p-8 shadow-sm relative overflow-hidden">
            {/* Glow Strip */}
            <div className={`absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r ${
              analysis.tradeScore >= 75 ? "from-emerald-500 to-teal-400" :
              analysis.tradeScore >= 50 ? "from-amber-500 to-orange-400" :
              "from-red-600 to-pink-500"
            }`}></div>

            <div className="text-center pb-4 border-b border-slate-100 mb-6">
              <h2 className="text-xs tracking-[0.2em] text-slate-400 font-mono font-black uppercase mb-4">
                TRADEMIND AI PRE-TRADE ANALYSIS
              </h2>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-slate-50 border border-slate-100 p-5 rounded-2xl">
                {/* Left Side: Go Ahead / Think Again / Avoid */}
                <div className="text-center sm:text-left space-y-1.5 w-full sm:w-auto">
                  <span className="text-[9px] tracking-wider text-slate-400 font-mono font-bold block uppercase">
                    DECISION VERDICT
                  </span>
                  <div>
                    <span className={`text-base md:text-lg font-black tracking-wider uppercase px-4 py-2 rounded-xl inline-block border ${
                      analysis.verdict === "Good Trade" ? "text-emerald-700 bg-emerald-50 border-emerald-100" :
                      analysis.verdict === "Think Again" ? "text-amber-700 bg-amber-50/80 border-amber-100" :
                      "text-rose-700 bg-rose-50 border-rose-100"
                    }`}>
                      {analysis.verdict === "Good Trade" ? "🟢 GO AHEAD" :
                       analysis.verdict === "Think Again" ? "🟡 THINK AGAIN" :
                       "🔴 AVOID"}
                    </span>
                  </div>
                </div>

                {/* Right Side: TRADEMIND DECISION METER */}
                <div className="text-center sm:text-left space-y-1.5 w-full sm:flex-1 sm:max-w-[200px]">
                  <span className="text-[9px] tracking-wider text-slate-400 font-mono font-bold block uppercase">
                    DECISION METER
                  </span>
                  <div className="flex items-center justify-center sm:justify-start gap-1.5">
                    <span className={`text-2xl font-black font-mono ${getDecisionColor(analysis.tradeScore, "text")}`}>
                      {analysis.tradeScore >= 75 ? "🟢" : analysis.tradeScore >= 50 ? "🟡" : "🔴"}{" "}{analysis.tradeScore}
                    </span>
                    <span className="text-slate-400 text-xs font-mono font-bold">/ 100</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1">
                    <div 
                      className={`h-full rounded-full transition-all duration-700 ${
                        analysis.tradeScore >= 75 ? "bg-emerald-500" :
                        analysis.tradeScore >= 50 ? "bg-amber-500" : "bg-rose-500"
                      }`} 
                      style={{ width: `${analysis.tradeScore}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Core Metrics List */}
            <div className="mt-8 space-y-4 font-mono text-xs text-slate-600 border-b border-slate-100 pb-6">
              
              {/* Pattern Match Rate */}
              <div className="flex justify-between items-center py-2 border-b border-slate-100/60">
                <span className="text-slate-400 font-semibold">Previous Winners Match:</span>
                <span className="text-sm font-extrabold text-emerald-600">
                  {analysis.matchWinningPatternPercent}%
                </span>
              </div>

              {/* Current Mindset */}
              <div className="flex justify-between items-center py-2 border-b border-slate-100/60">
                <span className="text-slate-400 font-semibold">Current Mindset:</span>
                <span className="text-sm font-extrabold text-[#0e1118]">
                  {analysis.emotionDetected === EmotionType.CALM && "😊 Calm"}
                  {analysis.emotionDetected === EmotionType.FEAR && "😟 Fear"}
                  {analysis.emotionDetected === EmotionType.REVENGE && "😡 Revenge"}
                  {analysis.emotionDetected === EmotionType.FOMO && "🤩 Over-Excited (FOMO)"}
                  {analysis.emotionDetected === EmotionType.NEUTRAL && "😐 Neutral"}
                  {![EmotionType.CALM, EmotionType.FEAR, EmotionType.REVENGE, EmotionType.FOMO, EmotionType.NEUTRAL].includes(analysis.emotionDetected) && `😐 ${analysis.emotionDetected}`}
                </span>
              </div>

              {/* Stress Level */}
              <div className="flex justify-between items-center py-2 border-b border-slate-100/60">
                <span className="text-slate-400 font-semibold">Stress Level:</span>
                <span className="text-sm font-extrabold flex items-center gap-1.5">
                  {analysis.riskLevel === "Low" ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span className="text-emerald-600">🟢 Low</span>
                    </>
                  ) : analysis.riskLevel === "Medium" ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      <span className="text-amber-600">🟡 Medium</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      <span className="text-rose-600">🔴 High</span>
                    </>
                  )}
                </span>
              </div>

              {/* Confidence Stars */}
              <div className="flex justify-between items-center py-2 border-b border-slate-100/60">
                <span className="text-slate-400 font-semibold">Confidence:</span>
                <span className="text-amber-500 text-sm font-extrabold">
                  {"★".repeat(confidenceStars)}{"☆".repeat(5 - confidenceStars)}
                </span>
              </div>

              {/* Risk Level */}
              <div className="flex justify-between items-center py-2 border-b border-slate-100/60">
                <span className="text-slate-400 font-semibold">Risk Level:</span>
                <span className="text-sm font-extrabold flex items-center gap-1.5">
                  {analysis.riskLevel === "Low" ? (
                    <span className="text-emerald-600">🟢 Low</span>
                  ) : analysis.riskLevel === "Medium" ? (
                    <span className="text-amber-600">🟡 Medium</span>
                  ) : (
                    <span className="text-rose-600">🔴 High</span>
                  )}
                </span>
              </div>

              {/* Trading Emotion */}
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-400 font-semibold">Trading Emotion:</span>
                <span className={`text-sm font-extrabold ${
                  ["Telegram Tip", "Recover Previous Loss", "Everyone is Buying", "Social Media"].includes(formData.reasonForTrade)
                    ? "text-rose-600" 
                    : "text-emerald-600"
                }`}>
                  {["Telegram Tip", "Everyone is Buying", "Social Media"].includes(formData.reasonForTrade) ? "⚠ FOMO" :
                   formData.reasonForTrade === "Recover Previous Loss" ? "⚠ Revenge / Greed" :
                   "Strategy Driven"}
                </span>
              </div>

            </div>



            {/* Coaching Decision Review Explanation */}
            <div className="space-y-4 bg-slate-50 border border-slate-100 p-5 rounded-2xl">
              <h4 className="text-xs uppercase font-mono font-bold text-indigo-600 flex items-center gap-1.5">
                <Brain className="w-4 h-4" />
                AI Psychologist Review
              </h4>
              <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                {analysis.whyDecisionReached}
              </p>
              
              {/* Discipline Recommendation */}
              <div className="pt-3 border-t border-slate-200 text-xs font-mono">
                <span className="text-slate-400 uppercase block font-bold">Recommended Discipline Action:</span>
                <span className="text-[#0e1118] font-extrabold mt-1 block">
                  👉 {analysis.recommendation}
                </span>
              </div>
            </div>

          </div>

          {/* Quick Buttons for resetting state */}
          <button
            onClick={() => setAnalysis(null)}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition shadow-md cursor-pointer text-center text-sm flex items-center justify-center gap-1.5 border border-indigo-600"
          >
            <RefreshCcw className="w-4 h-4" />
            Evaluate New Proposed Trade
          </button>
        </div>
      )}

      {/* 3. INPUT FORM SCREEN: Matches user specification precisely */}
      {!isSubmitting && !analysis && (
        <div className="bg-white border border-slate-100 rounded-3xl p-6 md:p-8 shadow-sm relative overflow-hidden" id="proposed-trade-form-card">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-indigo-600"></div>

          <div className="text-center mb-8">
            <h2 className="text-xl font-black text-[#0e1118] flex items-center justify-center gap-2">
              <Brain className="w-5 h-5 text-indigo-600" />
              Pre-Trade Psychological Evaluator
            </h2>
            <p className="text-xs text-slate-400 mt-1.5">
              Let AI analyze your behavior and risk profile before you execute your next trade.
            </p>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-5 font-medium">
            
            {/* What are you trading? Selector */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2.5 font-mono">
                What are you trading?
              </label>
              <div className="grid grid-cols-3 gap-3">
                {["Equity", "Futures", "Options"].map((type) => (
                  <label key={type} className={`border rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition text-center ${
                    formData.instrumentType === type 
                      ? "border-indigo-600 bg-indigo-50 text-[#0e1118]" 
                      : "border-slate-100 bg-slate-50/20 text-slate-500 hover:border-slate-200 hover:bg-slate-50"
                  }`}>
                    <input
                      type="radio"
                      name="instrumentType"
                      value={type}
                      checked={formData.instrumentType === type}
                      onChange={handleInputChange}
                      className="sr-only"
                    />
                    <span className="text-xs font-bold">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {formData.instrumentType === "Equity" && (
              <>
                {/* Stock Name */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5 font-mono">
                    Stock Name
                  </label>
                  <input
                    type="text"
                    name="stockName"
                    value={formData.stockName}
                    onChange={handleInputChange}
                    required={formData.instrumentType === "Equity"}
                    className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm text-[#0e1118] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Stock Symbol */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5 font-mono">
                    Stock Symbol
                  </label>
                  <input
                    type="text"
                    name="stockSymbol"
                    value={formData.stockSymbol}
                    onChange={handleInputChange}
                    required={formData.instrumentType === "Equity"}
                    className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm text-[#0e1118] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono uppercase"
                  />
                </div>

                {/* Trade Type (Intraday vs Swing Radio Buttons as specified) */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2.5 font-mono">
                    Trade Type
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <label className={`border rounded-xl p-3 flex items-center gap-2.5 cursor-pointer transition ${
                      formData.timeFrame === "Intraday"
                        ? "border-indigo-600 bg-indigo-50 text-[#0e1118]"
                        : "border-slate-100 bg-slate-50/20 text-slate-500 hover:border-slate-200 hover:bg-slate-50"
                    }`}>
                      <input
                        type="radio"
                        name="timeFrame"
                        value="Intraday"
                        checked={formData.timeFrame === "Intraday"}
                        onChange={handleInputChange}
                        className="sr-only"
                      />
                      <span className="w-2.5 h-2.5 rounded-full border border-slate-300 flex items-center justify-center">
                        {formData.timeFrame === "Intraday" && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>}
                      </span>
                      <span className="text-xs font-bold font-sans">Intraday Scalp</span>
                    </label>

                    <label className={`border rounded-xl p-3 flex items-center gap-2.5 cursor-pointer transition ${
                      formData.timeFrame === "Swing"
                        ? "border-indigo-600 bg-indigo-50 text-[#0e1118]"
                        : "border-slate-100 bg-slate-50/20 text-slate-500 hover:border-slate-200 hover:bg-slate-50"
                    }`}>
                      <input
                        type="radio"
                        name="timeFrame"
                        value="Swing"
                        checked={formData.timeFrame === "Swing"}
                        onChange={handleInputChange}
                        className="sr-only"
                      />
                      <span className="w-2.5 h-2.5 rounded-full border border-slate-300 flex items-center justify-center">
                        {formData.timeFrame === "Swing" && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>}
                      </span>
                      <span className="text-xs font-bold font-sans">Swing Trade</span>
                    </label>
                  </div>
                </div>

                {/* Entry Price */}
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5 font-mono">
                    Entry Price (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    name="entryPrice"
                    value={formData.entryPrice}
                    onChange={handleInputChange}
                    required={formData.instrumentType === "Equity"}
                    className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm text-[#0e1118] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>

                {/* Quantity */}
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5 font-mono">
                    Quantity
                  </label>
                  <input
                    type="number"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleInputChange}
                    required={formData.instrumentType === "Equity"}
                    className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm text-[#0e1118] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </>
            )}

            {formData.instrumentType === "Futures" && (
              <>
                {/* Underlying */}
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5 font-mono">
                    Underlying (e.g., NIFTY, BANKNIFTY, RELIANCE)
                  </label>
                  <input
                    type="text"
                    name="underlying"
                    value={formData.underlying}
                    onChange={handleInputChange}
                    required={formData.instrumentType === "Futures"}
                    className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm text-[#0e1118] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono uppercase"
                  />
                </div>

                {/* Expiry Date */}
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5 font-mono">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    name="expiryDate"
                    value={formData.expiryDate}
                    onChange={handleInputChange}
                    required={formData.instrumentType === "Futures"}
                    className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm text-[#0e1118] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>

                {/* Lot Size & Number of Lots */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5 font-mono">
                      Lot Size
                    </label>
                    <input
                      type="number"
                      name="lotSize"
                      value={formData.lotSize}
                      onChange={handleInputChange}
                      required={formData.instrumentType === "Futures"}
                      className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm text-[#0e1118] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5 font-mono">
                      Number of Lots
                    </label>
                    <input
                      type="number"
                      name="numLots"
                      value={formData.numLots}
                      onChange={handleInputChange}
                      required={formData.instrumentType === "Futures"}
                      className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm text-[#0e1118] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                </div>
              </>
            )}

            {formData.instrumentType === "Options" && (
              <>
                {/* Underlying */}
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5 font-mono">
                    Underlying (e.g., NIFTY, BANKNIFTY, RELIANCE)
                  </label>
                  <input
                    type="text"
                    name="underlying"
                    value={formData.underlying}
                    onChange={handleInputChange}
                    required={formData.instrumentType === "Options"}
                    className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm text-[#0e1118] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono uppercase"
                  />
                </div>

                {/* Expiry Date */}
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5 font-mono">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    name="expiryDate"
                    value={formData.expiryDate}
                    onChange={handleInputChange}
                    required={formData.instrumentType === "Options"}
                    className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm text-[#0e1118] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>

                {/* Call (CE) / Put (PE) Radio Cards */}
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-2.5 font-mono">
                    Call (CE) / Put (PE)
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <label className={`border rounded-xl p-3 flex items-center gap-2.5 cursor-pointer transition ${
                      formData.optionType === "CE"
                        ? "border-indigo-600 bg-indigo-50 text-[#0e1118]"
                        : "border-slate-100 bg-slate-50/20 text-slate-500 hover:border-slate-200 hover:bg-slate-50"
                    }`}>
                      <input
                        type="radio"
                        name="optionType"
                        value="CE"
                        checked={formData.optionType === "CE"}
                        onChange={handleInputChange}
                        className="sr-only"
                      />
                      <span className="text-xs font-bold font-mono">Call Option (CE)</span>
                    </label>

                    <label className={`border rounded-xl p-3 flex items-center gap-2.5 cursor-pointer transition ${
                      formData.optionType === "PE"
                        ? "border-indigo-600 bg-indigo-50 text-[#0e1118]"
                        : "border-slate-100 bg-slate-50/20 text-slate-500 hover:border-slate-200 hover:bg-slate-50"
                    }`}>
                      <input
                        type="radio"
                        name="optionType"
                        value="PE"
                        checked={formData.optionType === "PE"}
                        onChange={handleInputChange}
                        className="sr-only"
                      />
                      <span className="text-xs font-bold font-mono">Put Option (PE)</span>
                    </label>
                  </div>
                </div>

                {/* Strike Price */}
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5 font-mono">
                    Strike Price
                  </label>
                  <input
                    type="number"
                    name="strikePrice"
                    value={formData.strikePrice}
                    onChange={handleInputChange}
                    required={formData.instrumentType === "Options"}
                    className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm text-[#0e1118] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>

                {/* Lot Size & Number of Lots */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5 font-mono">
                      Lot Size
                    </label>
                    <input
                      type="number"
                      name="lotSize"
                      value={formData.lotSize}
                      onChange={handleInputChange}
                      required={formData.instrumentType === "Options"}
                      className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm text-[#0e1118] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5 font-mono">
                      Number of Lots
                    </label>
                    <input
                      type="number"
                      name="numLots"
                      value={formData.numLots}
                      onChange={handleInputChange}
                      required={formData.instrumentType === "Options"}
                      className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm text-[#0e1118] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Entry Price for Options/Futures */}
            {formData.instrumentType !== "Equity" && (
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5 font-mono">
                  Premium / Contract Price (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  name="entryPrice"
                  value={formData.entryPrice}
                  onChange={handleInputChange}
                  required
                  className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm text-[#0e1118] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>
            )}

            {/* Stop Loss */}
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5 font-mono">
                Stop Loss
              </label>
              <input
                type="number"
                step="any"
                name="stopLoss"
                value={formData.stopLoss}
                onChange={handleInputChange}
                required
                className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm text-[#0e1118] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>

            {/* Target */}
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5 font-mono">
                Target
              </label>
              <input
                type="number"
                step="any"
                name="target"
                value={formData.target}
                onChange={handleInputChange}
                required
                className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm text-[#0e1118] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>

            {/* Trade Date */}
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5 font-mono">
                Trade Date
              </label>
              <input
                type="date"
                name="tradeDate"
                value={formData.tradeDate}
                onChange={handleInputChange}
                required
                className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm text-[#0e1118] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>

            {/* Trade Time */}
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5 font-mono">
                Trade Time
              </label>
              <input
                type="time"
                name="tradeTime"
                value={formData.tradeTime}
                onChange={handleInputChange}
                required
                className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm text-[#0e1118] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>

            {/* Why are you taking this trade? (Dropdown as specified) */}
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5 font-mono">
                Why are you taking this trade?
              </label>
              <select
                name="reasonForTrade"
                value={formData.reasonForTrade}
                onChange={handleInputChange}
                className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm text-[#0e1118] focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                {reasons.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Which strategy? (Dropdown as specified) */}
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5 font-mono">
                Which strategy?
              </label>
              <select
                name="strategyUsed"
                value={formData.strategyUsed}
                onChange={handleInputChange}
                className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm text-[#0e1118] focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                {strategies.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Interactive Stars Confidence Slider */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                  How confident are you?
                </label>
                <span className="text-xs font-bold text-indigo-600 font-mono">
                  {confidenceStars} / 5 Rating
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center justify-center gap-3 shadow-inner">
                {[1, 2, 3, 4, 5].map((starVal) => {
                  const isActive = starVal <= confidenceStars;
                  return (
                    <button
                      key={starVal}
                      type="button"
                      onClick={() => setConfidenceStars(starVal)}
                      className="text-2xl md:text-3xl focus:outline-none hover:scale-110 transition cursor-pointer"
                      title={`${starVal} Star Confidence`}
                    >
                      {isActive ? (
                        <span className="text-amber-400 select-none">★</span>
                      ) : (
                        <span className="text-slate-200 select-none">☆</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-6 flex gap-4">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 hover:text-slate-900 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              
              <button
                type="submit"
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer border border-indigo-600"
              >
                🔍 Analyze My Proposed Trade
              </button>
            </div>

          </form>
        </div>
      )}

    </div>
  );
}
