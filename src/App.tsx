import React, { useState, useEffect } from "react";
import { 
  LayoutDashboard, Brain, FileSpreadsheet, Sparkles, BarChart3, 
  RotateCcw, Trash2, ArrowLeftRight, Activity, Menu, X, AlertTriangle
} from "lucide-react";
import { Trade, TradingProfile, NewTradeAnalysisResponse, TradeDirection, ConfidenceLevel, EmotionType } from "./types.js";
import { calculateTradingProfile } from "./utils/stats.js";
import UploadSection from "./components/UploadSection.tsx";
import Dashboard from "./components/Dashboard.tsx";
import AnalyzeTradeForm from "./components/AnalyzeTradeForm.tsx";
import LearningAnimation from "./components/LearningAnimation.tsx";
import PerformanceTable from "./components/PerformanceTable.tsx";
import ChartsView from "./components/ChartsView.tsx";

type TabType = "dashboard" | "evaluate" | "performance" | "charts";

export default function App() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [reportName, setReportName] = useState<string>("");
  const [profile, setProfile] = useState<TradingProfile | null>(null);
  
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // States for the sequential AI Starts Learning progress screen
  const [isLearning, setIsLearning] = useState(false);
  const [pendingTradesData, setPendingTradesData] = useState<{ trades: Trade[]; name: string } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Load from session storage on mount
  useEffect(() => {
    const cachedTrades = sessionStorage.getItem("trademind_trades");
    const cachedName = sessionStorage.getItem("trademind_report_name");
    
    if (cachedTrades && cachedName) {
      try {
        const parsedTrades = JSON.parse(cachedTrades) as Trade[];
        setTrades(parsedTrades);
        setReportName(cachedName);
        
        // Calculate raw mathematical profile
        const rawProfile = calculateTradingProfile(parsedTrades);
        setProfile(rawProfile);
        
        // Fetch fresh AI qualitative summary asynchronously
        refreshAISummary(parsedTrades, cachedName);
      } catch (e) {
        console.error("Failed to parse cached trade logs", e);
      }
    }
  }, []);

  // Sync to session storage
  const saveToStorage = (updatedTrades: Trade[], name: string) => {
    sessionStorage.setItem("trademind_trades", JSON.stringify(updatedTrades));
    sessionStorage.setItem("trademind_report_name", name);
  };

  const handleDataLoaded = async (loadedTrades: Trade[], name: string) => {
    setPendingTradesData({ trades: loadedTrades, name });
    setIsLearning(true);
    
    // Start background analysis immediately so it's ready when the animation finishes
    refreshAISummary(loadedTrades, name);
  };

  const handleLearningComplete = () => {
    if (pendingTradesData) {
      const { trades: loadedTrades, name } = pendingTradesData;
      setTrades(loadedTrades);
      setReportName(name);
      saveToStorage(loadedTrades, name);
    }
    setIsLearning(false);
    setActiveTab("dashboard");
  };

  const refreshAISummary = async (currentTrades: Trade[], name: string) => {
    setIsLoadingProfile(true);
    setProfileError(null);
    try {
      const response = await fetch("/api/analyze-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trades: currentTrades })
      });

      if (!response.ok) {
        throw new Error("Psychologist server failed to analyze the report.");
      }

      const data = await response.json() as { profile: TradingProfile; mode: string };
      setProfile(data.profile);
    } catch (err: any) {
      console.error(err);
      // Fallback: use mathematically calculated profile with basic summaries if server has issues
      const localProfile = calculateTradingProfile(currentTrades);
      localProfile.behaviorSummary = "We noticed some inconsistencies in your timing. Let's make sure to refine setups before entering volatility periods.";
      setProfile(localProfile);
      setProfileError("Could not reach AI Analyst. Utilizing local statistics engine.");
    } finally {
      setIsLoadingProfile(false);
    }
  };

  // Submit current trade for pre-entry AI assessment
  const handleAnalyzeTrade = async (currentTrade: any): Promise<NewTradeAnalysisResponse> => {
    const activeProfile = profile || calculateTradingProfile(trades);
    const response = await fetch("/api/analyze-trade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentTrade, profile: activeProfile })
    });

    if (!response.ok) {
      throw new Error("Risk Coach failed to evaluate the trade.");
    }

    const data = await response.json() as { analysis: NewTradeAnalysisResponse; mode: string };
    return data.analysis;
  };

  const handleClearAll = () => {
    setShowResetConfirm(true);
  };

  const executeClearAll = () => {
    sessionStorage.removeItem("trademind_trades");
    sessionStorage.removeItem("trademind_report_name");
    setTrades([]);
    setReportName("");
    setProfile(null);
    setActiveTab("dashboard");
    setMobileMenuOpen(false);
    setShowResetConfirm(false);
  };

  return (
    <div className="min-h-screen bg-[#f4f5f7] text-[#0e1118] flex flex-col font-sans">
      
      {/* Loading overlay for report processing */}
      {isLoadingProfile && trades.length > 0 && (
        <div className="bg-[#f4f5f7]/90 backdrop-blur-sm fixed inset-0 z-50 flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full border-2 border-slate-200 border-t-[#11131e] animate-spin mb-4"></div>
          <p className="text-sm font-semibold text-[#0e1118]">Consulting TradeMind Psychologist...</p>
          <p className="text-xs text-slate-500 mt-1">Recalculating emotional triggers and streak metrics</p>
        </div>
      )}

      {/* RENDER PHASE 1: Learning Animation */}
      {isLearning && (
        <LearningAnimation 
          fileName={pendingTradesData?.name || "Report"} 
          onComplete={handleLearningComplete} 
        />
      )}

      {/* RENDER PHASE 2: Landing / File Upload */}
      {!isLearning && trades.length === 0 && (
        <div className="flex-1 min-h-screen flex flex-col bg-[#f4f5f7]">
          <UploadSection onDataLoaded={handleDataLoaded} isLoading={isLoadingProfile} />
        </div>
      )}

      {/* RENDER PHASE 3: Fully Loaded Horizontal Header + Main Workspace */}
      {!isLearning && trades.length > 0 && (
        <>
          {/* Horizontal Top Header Navbar - Styled exactly like Zentra */}
          <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Zentra-like Orange Square Gradient Logo */}
              <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-sm">
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <span className="text-lg font-black tracking-tight text-[#0e1118] flex items-center gap-1.5">
                zentra <span className="text-xs font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">tradeMind</span>
              </span>
            </div>

            {/* Desktop Center Navigation Pills */}
            <nav className="hidden md:flex items-center gap-1 bg-slate-100/60 p-1 rounded-full border border-slate-200/50">
              <button
                onClick={() => { setActiveTab("dashboard"); }}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  activeTab === "dashboard"
                    ? "bg-[#11131e] text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => { setActiveTab("evaluate"); }}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  activeTab === "evaluate"
                    ? "bg-[#11131e] text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Analyze New Trade
              </button>
              <button
                onClick={() => { setActiveTab("performance"); }}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  activeTab === "performance"
                    ? "bg-[#11131e] text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Performance
              </button>

              <button
                onClick={() => { setActiveTab("charts"); }}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  activeTab === "charts"
                    ? "bg-[#11131e] text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Charts
              </button>
            </nav>

            {/* Right: File details + reset triggers */}
            <div className="hidden md:flex items-center gap-3">
              <div className="text-right font-mono text-[10px] text-slate-400 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                <span className="font-bold text-slate-500 mr-1">LEDGER:</span>
                <span className="truncate max-w-[120px] inline-block align-bottom" title={reportName}>{reportName}</span>
              </div>
              <button
                onClick={handleClearAll}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition cursor-pointer"
                title="Unload Current Ledger"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile Hamburger Toggle */}
            <div className="flex md:hidden items-center gap-2">
              <button
                onClick={handleClearAll}
                className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg"
                title="Unload Current Ledger"
              >
                <RotateCcw className="w-4.5 h-4.5" />
              </button>
              <button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 bg-slate-50"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </header>

          {/* Mobile Navigation Drawer */}
          {mobileMenuOpen && (
            <div className="md:hidden fixed inset-0 top-[60px] z-40 bg-white flex flex-col border-b border-slate-100 animate-slide-down p-6 space-y-4 shadow-xl">
              <button
                onClick={() => { setActiveTab("dashboard"); setMobileMenuOpen(false); }}
                className={`w-full py-3 px-4 rounded-xl text-sm font-bold text-left transition ${
                  activeTab === "dashboard" ? "bg-slate-100 text-[#0e1118]" : "text-slate-500"
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => { setActiveTab("evaluate"); setMobileMenuOpen(false); }}
                className={`w-full py-3 px-4 rounded-xl text-sm font-bold text-left transition ${
                  activeTab === "evaluate" ? "bg-slate-100 text-[#0e1118]" : "text-slate-500"
                }`}
              >
                Analyze New Trade
              </button>
              <button
                onClick={() => { setActiveTab("performance"); setMobileMenuOpen(false); }}
                className={`w-full py-3 px-4 rounded-xl text-sm font-bold text-left transition ${
                  activeTab === "performance" ? "bg-slate-100 text-[#0e1118]" : "text-slate-500"
                }`}
              >
                Performance
              </button>

              <button
                onClick={() => { setActiveTab("charts"); setMobileMenuOpen(false); }}
                className={`w-full py-3 px-4 rounded-xl text-sm font-bold text-left transition ${
                  activeTab === "charts" ? "bg-slate-100 text-[#0e1118]" : "text-slate-500"
                }`}
              >
                Charts
              </button>
            </div>
          )}

          {/* Main Workspace Panel */}
          <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 md:py-8 max-w-7xl mx-auto w-full">
            
            {/* Fallback warning block */}
            {profileError && (
              <div className="mb-6">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-700 text-xs flex items-center gap-2 leading-relaxed">
                  <Activity className="w-4.5 h-4.5 shrink-0 text-amber-500" />
                  <span>{profileError}</span>
                </div>
              </div>
            )}

            {/* Render views based on activeTab */}
            {activeTab === "dashboard" && profile && (
              <Dashboard 
                profile={profile} 
                trades={trades} 
                reportName={reportName}
                onAnalyzeNewTradeClick={() => setActiveTab("evaluate")}
                onResetClick={handleClearAll}
              />
            )}

            {activeTab === "evaluate" && profile && (
              <AnalyzeTradeForm
                profile={profile}
                onSubmit={handleAnalyzeTrade}
                onCancel={() => setActiveTab("dashboard")}
                isLoading={isLoadingProfile}
              />
            )}

            {activeTab === "performance" && (
              <PerformanceTable trades={trades} />
            )}



            {activeTab === "charts" && profile && (
              <ChartsView profile={profile} trades={trades} />
            )}

          </main>
        </>
      )}

      {/* Custom Confirmation Modal for Resetting/Uploading different log */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" id="reset-confirm-modal">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" 
            onClick={() => setShowResetConfirm(false)}
          ></div>
          
          {/* Card */}
          <div className="relative bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 md:p-8 space-y-6 shadow-xl animate-fade-in">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-50 border border-red-100 text-red-500 rounded-2xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-[#0e1118] font-sans tracking-tight">Unload Trading Logs?</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Are you sure you want to unload your current trading logs? This will clear the active dashboard and let you upload a completely different ledger file.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeClearAll}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl transition shadow-lg cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Unload & Upload New
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
