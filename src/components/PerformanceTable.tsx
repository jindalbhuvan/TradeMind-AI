import React, { useState } from "react";
import { 
  Search, Filter, ChevronLeft, ChevronRight, ArrowUpDown, 
  CheckCircle2, AlertCircle, FileSpreadsheet, Calendar
} from "lucide-react";
import { Trade } from "../types.js";

interface PerformanceTableProps {
  trades: Trade[];
}

export default function PerformanceTable({ trades }: PerformanceTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStrategy, setSelectedStrategy] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All"); // All, Profit, Loss
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Extract unique strategies for filters
  const uniqueStrategies = Array.from(new Set(trades.map((t) => t.strategyUsed).filter(Boolean)));

  // Filter trades
  const filteredTrades = trades.filter((t) => {
    const symbolMatch = t.stockSymbol.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        t.stockName.toLowerCase().includes(searchTerm.toLowerCase());
    const strategyMatch = selectedStrategy === "All" || t.strategyUsed === selectedStrategy;
    const statusMatch = selectedStatus === "All" || 
                        (selectedStatus === "Profit" && t.pnl > 0) || 
                        (selectedStatus === "Loss" && t.pnl <= 0);
    
    return symbolMatch && strategyMatch && statusMatch;
  });

  // Sort trades chronologically descending (newest first)
  const sortedTrades = [...filteredTrades].sort((a, b) => {
    const dateTimeA = new Date(`${a.tradeDate}T${a.tradeTime || "00:00"}`).getTime();
    const dateTimeB = new Date(`${b.tradeDate}T${b.tradeTime || "00:00"}`).getTime();
    return dateTimeB - dateTimeA;
  });

  // Pagination
  const totalPages = Math.ceil(sortedTrades.length / itemsPerPage);
  const paginatedTrades = sortedTrades.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Currency formatter
  const formatRs = (val: number) => {
    const isNegative = val < 0;
    const absVal = Math.abs(val);
    const symbol = "₹";
    return `${isNegative ? "-" : ""}${symbol}${Math.round(absVal).toLocaleString("en-IN")}`;
  };  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8" id="performance-table-view">
      
      {/* Header */}
      <div className="border-b border-slate-100 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="text-center md:text-left">
          <h1 className="text-2xl font-black text-[#0e1118] tracking-tight flex items-center justify-center md:justify-start gap-2">
            <FileSpreadsheet className="w-6 h-6 text-indigo-600" />
            Trade Performance Ledger
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono uppercase tracking-wider">
            VERIFIED ORDER HISTORY & PARSED AUDITS
          </p>
        </div>
        <div className="bg-white border border-slate-100 px-4 py-2 rounded-xl text-center self-center md:self-auto shrink-0 font-mono text-xs text-slate-500 shadow-sm">
          Total Logs Loaded: <span className="text-indigo-600 font-extrabold">{trades.length}</span>
        </div>
      </div>

      {/* Stats Summary Ribbons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* Metric 1 */}
        <div className="bg-white border border-slate-100 p-4 rounded-2xl text-center shadow-sm">
          <span className="text-[10px] text-slate-400 font-mono uppercase block font-semibold tracking-wider">Profitable Trades</span>
          <span className="text-xl font-extrabold text-emerald-600 font-mono block mt-1">
            {trades.filter(t => t.pnl > 0).length}
          </span>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-slate-100 p-4 rounded-2xl text-center shadow-sm">
          <span className="text-[10px] text-slate-400 font-mono uppercase block font-semibold tracking-wider">Unprofitable Trades</span>
          <span className="text-xl font-extrabold text-rose-600 font-mono block mt-1">
            {trades.filter(t => t.pnl <= 0).length}
          </span>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-slate-100 p-4 rounded-2xl text-center shadow-sm">
          <span className="text-[10px] text-slate-400 font-mono uppercase block font-semibold tracking-wider">Win Ratio</span>
          <span className="text-xl font-extrabold text-indigo-600 font-mono block mt-1">
            {trades.length > 0 ? Math.round((trades.filter(t => t.pnl > 0).length / trades.length) * 100) : 0}%
          </span>
        </div>

        {/* Metric 4 */}
        <div className="bg-white border border-slate-100 p-4 rounded-2xl text-center shadow-sm">
          <span className="text-[10px] text-slate-400 font-mono uppercase block font-semibold tracking-wider">Net Yield</span>
          <span className={`text-xl font-extrabold font-mono block mt-1 ${
            trades.reduce((sum, t) => sum + t.pnl, 0) >= 0 ? "text-emerald-600" : "text-rose-600"
          }`}>
            {formatRs(trades.reduce((sum, t) => sum + t.pnl, 0))}
          </span>
        </div>

      </div>

      {/* Search & Filters Controls */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-3 gap-4 shadow-sm">
        
        {/* Search */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search symbol or company..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full bg-slate-50/50 border border-slate-100 rounded-xl pl-9 pr-4 py-2.5 text-xs text-[#0e1118] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono placeholder-slate-400"
          />
        </div>

        {/* Filter Strategy */}
        <div>
          <select
            value={selectedStrategy}
            onChange={(e) => { setSelectedStrategy(e.target.value); setCurrentPage(1); }}
            className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs text-[#0e1118] focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer font-mono"
          >
            <option value="All">All Strategies</option>
            {uniqueStrategies.map((s, idx) => (
              <option key={idx} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Filter Status */}
        <div>
          <select
            value={selectedStatus}
            onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
            className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-3 py-2.5 text-xs text-[#0e1118] focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer font-mono"
          >
            <option value="All">All Results</option>
            <option value="Profit">🟢 Profits Only</option>
            <option value="Loss">🔴 Losses Only</option>
          </select>
        </div>

      </div>

      {/* Main Ledger Table */}
      <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left font-mono text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-400 font-bold uppercase select-none text-[10px] tracking-wider">
                <th className="py-4 px-5 text-[#0e1118]">Symbol / Name</th>
                <th className="py-4 px-4 text-center text-[#0e1118]">Type</th>
                <th className="py-4 px-4 text-right text-[#0e1118]">Entry Price</th>
                <th className="py-4 px-4 text-center text-[#0e1118]">Qty</th>
                <th className="py-4 px-4 text-[#0e1118]">Strategy</th>
                <th className="py-4 px-4 text-[#0e1118]">Execution Date</th>
                <th className="py-4 px-5 text-right text-[#0e1118]">PnL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/70">
              {paginatedTrades.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    No order records match your active search filters.
                  </td>
                </tr>
              ) : (
                paginatedTrades.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition duration-150">
                    <td className="py-4 px-5">
                      <div className="font-extrabold text-[#0e1118] text-sm">{t.stockSymbol}</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[150px] font-sans mt-0.5">{t.stockName}</div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-md font-extrabold font-sans text-[10px] uppercase border ${
                        t.direction === "Buy" 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                          : "bg-rose-50 text-rose-700 border-rose-100"
                      }`}>
                        {t.direction || "Buy"}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right text-slate-700 font-extrabold">
                      {formatRs(t.entryPrice)}
                    </td>
                    <td className="py-4 px-4 text-center text-slate-500 font-bold">
                      {t.quantity}
                    </td>
                    <td className="py-4 px-4 text-slate-500 font-sans">
                      {t.strategyUsed || "N/A"}
                    </td>
                    <td className="py-4 px-4 text-slate-500 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{t.tradeDate} {t.tradeTime || "00:00"}</span>
                      </div>
                    </td>
                    <td className="py-4 px-5 text-right font-extrabold text-sm">
                      <span className={t.pnl > 0 ? "text-emerald-600" : "text-rose-600"}>
                        {t.pnl > 0 ? "+" : ""}
                        {formatRs(t.pnl)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="bg-slate-50/50 border-t border-slate-100 py-4 px-5 flex items-center justify-between font-mono text-xs select-none">
            <span className="text-slate-400">
              Showing page <span className="text-[#0e1118] font-bold">{currentPage}</span> of <span className="text-[#0e1118] font-bold">{totalPages}</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-[#0e1118] disabled:opacity-40 disabled:cursor-not-allowed transition hover:bg-slate-50 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-[#0e1118] disabled:opacity-40 disabled:cursor-not-allowed transition hover:bg-slate-50 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
