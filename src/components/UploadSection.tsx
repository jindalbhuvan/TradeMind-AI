import React, { useState, useRef } from "react";
import { Upload, FileText, CheckCircle2, AlertTriangle, HelpCircle, Check } from "lucide-react";
import * as XLSX from "xlsx";
import { Trade, TradeDirection, ConfidenceLevel, EmotionType } from "../types.js";

interface UploadSectionProps {
  onDataLoaded: (trades: Trade[], reportName: string) => void;
  isLoading: boolean;
}

export default function UploadSection({ onDataLoaded, isLoading }: UploadSectionProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pastedCSV, setPastedCSV] = useState("");
  const [showPasteArea, setShowPasteArea] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to standardise dates to YYYY-MM-DD
  const formatToStandardDate = (str: string): string => {
    const s = str.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    
    // Parse formats like DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      return `${year}-${month}-${day}`;
    }

    // Parse DD-MMM-YYYY (e.g. 15-Jun-2026)
    const dmmmMatch = s.match(/^(\d{1,2})[\/\-]([a-zA-Z]{3,9})[\/\-](\d{4})$/);
    if (dmmmMatch) {
      const day = dmmmMatch[1].padStart(2, '0');
      const monthStr = dmmmMatch[2].toLowerCase();
      const year = dmmmMatch[3];
      const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
      const monthIndex = months.findIndex(m => monthStr.startsWith(m));
      if (monthIndex !== -1) {
        const month = String(monthIndex + 1).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }
    
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split("T")[0];
    }
    return s;
  };

  // Helper to standardise times to HH:MM
  const formatToStandardTime = (str: string): string => {
    const s = str.trim();
    const match = s.match(/^(\d{1,2}):(\d{1,2})/);
    if (match) {
      return `${match[1].padStart(2, '0')}:${match[2].padStart(2, '0')}`;
    }
    return s;
  };

  // Parse CSV string into Trade objects, auto-matching raw orders into closed trades if needed
  const parseCSVData = (text: string): Trade[] => {
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line !== "");
    if (lines.length < 2) {
      throw new Error("Report seems empty. Please provide headers and at least one order record.");
    }

    // --- PHASE 1: SCAN FOR LEADING METADATA (Client Name, Client ID, Dates) ---
    let clientName = "";
    let clientId = "";
    let headerLineIndex = -1;
    let headers: string[] = [];

    // Scan up to first 30 lines to locate the main table headers
    for (let i = 0; i < Math.min(30, lines.length); i++) {
      const line = lines[i];
      // Simple parse of CSV columns
      const cols = line.split(",").map(c => c.trim().toLowerCase());
      
      const hasSymbol = cols.some(c => c.includes("symbol") || c.includes("ticker") || c.includes("stock"));
      const hasQty = cols.some(c => c.includes("qty") || c.includes("quantity") || c.includes("size") || c.includes("volume"));
      const hasValueOrPrice = cols.some(c => c.includes("value") || c.includes("price") || c.includes("amount") || c.includes("rate") || c.includes("price"));
      
      if (hasSymbol && (hasQty || hasValueOrPrice)) {
        headerLineIndex = i;
        headers = cols;
        break;
      }
    }

    // If we couldn't find a standard table header, fall back to index 0
    if (headerLineIndex === -1) {
      headerLineIndex = 0;
      headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    }

    // Extract metadata from any lines preceding the headers
    for (let i = 0; i < headerLineIndex; i++) {
      const line = lines[i];
      const lower = line.toLowerCase();
      const parts = line.split(/[,:]/);
      
      if (parts.length > 1) {
        const value = parts[1].trim().replace(/^["']|["']$/g, "").trim();
        if (lower.includes("name") && (lower.includes("client") || lower.includes("trader") || lower.includes("my"))) {
          clientName = value;
        } else if (lower.includes("id") && (lower.includes("client") || lower.includes("unique"))) {
          clientId = value;
        }
      }
    }

    // --- PHASE 2: DEFINE COLUMN INDEXES ---
    const symbolIdx = headers.findIndex(h => h.includes("symbol") || h.includes("ticker") || h.includes("stock symbol") || h === "sym");
    const stockNameIdx = headers.findIndex(h => h.includes("stock name") || h.includes("company") || h.includes("security") || (h.includes("name") && !h.includes("client") && h !== "my name"));
    const isinIdx = headers.findIndex(h => h.includes("is in") || h.includes("isin"));
    const typeIdx = headers.findIndex(h => h.includes("type") || h.includes("action") || h.includes("direction") || h.includes("buy/sell") || h.includes("trans"));
    const qtyIdx = headers.findIndex(h => h.includes("qty") || h.includes("quantity") || h.includes("shares") || h.includes("vol"));
    
    // We prioritize "price" / "rate" for share price; if only "value" / "amount" is found, we map that
    const priceIdx = headers.findIndex(h => h.includes("price") || h.includes("rate") || h.includes("execution price") || h.includes("buy price") || h.includes("sell price"));
    const valueIdx = headers.findIndex(h => h.includes("value") || h.includes("amount") || h.includes("total value") || h.includes("val"));
    
    const exchangeIdx = headers.findIndex(h => h.includes("exchange") || h.includes("mkt") || h.includes("market"));
    const orderIdIdx = headers.findIndex(h => h.includes("order id") || h.includes("orderid") || h.includes("execution id"));
    const statusIdx = headers.findIndex(h => h.includes("status") || h.includes("order status") || h.includes("state"));
    
    // Separate date/time columns or combined date and time column
    const dateTimeIdx = headers.findIndex(h => h.includes("date and time") || h.includes("execution date and time") || h.includes("timestamp") || h.includes("date & time"));
    const dateIdx = headers.findIndex(h => h === "date" || h.includes("trade date") || h.includes("execution date") || h.includes("date"));
    const timeIdx = headers.findIndex(h => h === "time" || h.includes("trade time") || h.includes("execution time") || h.includes("time"));

    const clientNameColIdx = headers.findIndex(h => h.includes("client name") || h.includes("my name") || h === "name");
    const clientIdColIdx = headers.findIndex(h => h.includes("client id") || h.includes("unique client id") || h === "id" || h === "clientid");

    if (symbolIdx === -1) {
      throw new Error("Could not locate 'Symbol' or 'Ticker' column in your CSV. Please ensure your file includes a header line.");
    }

    // --- PHASE 3: PARSE DATA ROWS ---
    interface TempOrder {
      symbol: string;
      stockName: string;
      isin: string;
      direction: TradeDirection;
      quantity: number;
      price: number;
      date: string;
      time: string;
      exchange: string;
      orderId: string;
      orderStatus: string;
    }

    const rawOrders: TempOrder[] = [];
    const directClosedTrades: Trade[] = [];

    // Let's check if the CSV already has closed trades (e.g. both Entry and Exit price or a P&L column)
    const isAlreadyClosed = headers.some(h => h.includes("exit") || h.includes("sell price") || h.includes("close price") || h.includes("pnl") || h.includes("profit"));

    for (let i = headerLineIndex + 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map(c => c.trim().replace(/^["']|["']$/g, ""));
      if (cols.length < Math.max(symbolIdx, 1)) continue;

      const symbol = (cols[symbolIdx] || "UNK").toUpperCase();
      if (!symbol || symbol === "SYMBOL") continue; // skip accidental repeated header lines

      // Extract client metadata from columns if present
      if (clientNameColIdx !== -1 && cols[clientNameColIdx] && !clientName) {
        clientName = cols[clientNameColIdx];
      }
      if (clientIdColIdx !== -1 && cols[clientIdColIdx] && !clientId) {
        clientId = cols[clientIdColIdx];
      }

      // Filter out non-completed/non-success orders if status column exists
      if (statusIdx !== -1 && cols[statusIdx]) {
        const st = cols[statusIdx].toLowerCase();
        if (st.includes("cancel") || st.includes("reject") || st.includes("fail") || st.includes("pending")) {
          continue; // skip cancelled or failed orders
        }
      }

      const stockName = cols[stockNameIdx] || `${symbol} Shares`;
      const isin = cols[isinIdx] || "";
      const exchange = cols[exchangeIdx] || "NSE";
      const orderId = cols[orderIdIdx] || `ORD-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const orderStatus = cols[statusIdx] || "Completed";

      // Trade direction
      const dirStr = cols[typeIdx]?.toLowerCase() || "buy";
      const direction = (dirStr.includes("sell") || dirStr.includes("short") || dirStr.startsWith("s"))
        ? TradeDirection.SELL
        : TradeDirection.BUY;

      const quantity = Math.max(1, Number(cols[qtyIdx]) || 1);

      // Resolve execution price or total value
      let price = 0;
      if (priceIdx !== -1 && cols[priceIdx]) {
        price = Number(cols[priceIdx]);
      } else if (valueIdx !== -1 && cols[valueIdx]) {
        const rawVal = Number(cols[valueIdx]) || 0;
        // Smart heuristic: if Value is extremely large relative to common stock price, divide by quantity
        if (rawVal > 5000 && quantity > 1 && rawVal > quantity * 5) {
          price = Number((rawVal / quantity).toFixed(2));
        } else {
          price = rawVal;
        }
      }

      // Parse execution date & time
      let tradeDate = new Date().toISOString().split("T")[0];
      let tradeTime = "10:00";

      if (dateTimeIdx !== -1 && cols[dateTimeIdx]) {
        const rawDT = cols[dateTimeIdx];
        const parts = rawDT.split(/\s+/);
        if (parts.length > 0) tradeDate = formatToStandardDate(parts[0]);
        if (parts.length > 1) tradeTime = formatToStandardTime(parts[1]);
      } else {
        if (dateIdx !== -1 && cols[dateIdx]) {
          tradeDate = formatToStandardDate(cols[dateIdx]);
        }
        if (timeIdx !== -1 && cols[timeIdx]) {
          tradeTime = formatToStandardTime(cols[timeIdx]);
        }
      }

      if (isAlreadyClosed) {
        // If file already has closed trades (direct mapping)
        const entryPrice = price || Number(cols[headers.findIndex(h => h.includes("entry") || h.includes("buy price"))]) || 0;
        const exitPrice = Number(cols[headers.findIndex(h => h.includes("exit") || h.includes("sell price") || h.includes("close price"))]) || entryPrice;
        
        let pnlIdx = headers.findIndex(h => h.includes("pnl") || h.includes("profit") || h.includes("gain") || h.includes("loss"));
        let pnl = pnlIdx !== -1 ? Number(cols[pnlIdx]) : NaN;
        if (isNaN(pnl)) {
          const factor = direction === TradeDirection.BUY ? 1 : -1;
          pnl = Number(((exitPrice - entryPrice) * quantity * factor).toFixed(2));
        }

        directClosedTrades.push({
          id: `direct-${i}-${Date.now()}`,
          stockName,
          stockSymbol: symbol,
          direction,
          timeFrame: "Daily",
          entryPrice,
          exitPrice,
          quantity,
          tradeDate,
          tradeTime,
          strategyUsed: "Technical Setup",
          reasonForTrade: "Historical Log",
          confidenceLevel: ConfidenceLevel.MEDIUM,
          pnl,
          holdingTimeMinutes: 60,
          emotion: EmotionType.NEUTRAL,
          isin,
          exchange,
          orderId,
          orderStatus,
          clientName,
          clientId
        });
      } else {
        // Raw individual order to be FIFO matched
        rawOrders.push({
          symbol,
          stockName,
          isin,
          direction,
          quantity,
          price,
          date: tradeDate,
          time: tradeTime,
          exchange,
          orderId,
          orderStatus
        });
      }
    }

    // If we parsed direct closed trades, return them directly
    if (isAlreadyClosed && directClosedTrades.length > 0) {
      return directClosedTrades;
    }

    if (rawOrders.length === 0) {
      throw new Error("No completed order transactions could be parsed. Check column headers and order statuses.");
    }

    // --- PHASE 4: FIFO ORDER MATCHING ALGORITHM ---
    // Sort raw orders chronologically (oldest to newest)
    rawOrders.sort((a, b) => {
      const dtA = new Date(`${a.date}T${a.time}`).getTime();
      const dtB = new Date(`${b.date}T${b.time}`).getTime();
      return dtA - dtB;
    });

    const closedTrades: Trade[] = [];
    // Open positions group by symbol: queues of open order fills
    const openPositions: Record<string, {
      price: number;
      qty: number;
      date: string;
      time: string;
      direction: TradeDirection;
      orderId: string;
    }[]> = {};

    for (const order of rawOrders) {
      const sym = order.symbol;
      if (!openPositions[sym]) {
        openPositions[sym] = [];
      }

      const queue = openPositions[sym];
      
      if (queue.length === 0) {
        // Open new position legs
        queue.push({
          price: order.price,
          qty: order.quantity,
          date: order.date,
          time: order.time,
          direction: order.direction,
          orderId: order.orderId
        });
      } else {
        // If matching direction (e.g. queue has BUYs and we BUY again) -> stack open fills
        if (queue[0].direction === order.direction) {
          queue.push({
            price: order.price,
            qty: order.quantity,
            date: order.date,
            time: order.time,
            direction: order.direction,
            orderId: order.orderId
          });
        } else {
          // Opposite direction -> close/match open fills using FIFO (First-In, First-Out)
          let remainingQty = order.quantity;
          
          while (remainingQty > 0 && queue.length > 0) {
            const openFill = queue[0];
            const matchedQty = Math.min(openFill.qty, remainingQty);

            // Calculate holding time in minutes
            const openDT = new Date(`${openFill.date}T${openFill.time}`).getTime();
            const closeDT = new Date(`${order.date}T${order.time}`).getTime();
            const holdingTimeMs = Math.max(0, closeDT - openDT);
            const holdingMinutes = Math.round(holdingTimeMs / 60000) || 30; // default 30 mins if timestamp match is instant

            // Calculate PnL: if original position was BUY (long), PnL = (sellPrice - buyPrice) * qty. Else PnL = (buyPrice - sellPrice) * qty.
            const entryPrice = openFill.price;
            const exitPrice = order.price;
            const factor = openFill.direction === TradeDirection.BUY ? 1 : -1;
            const pnl = Number(((exitPrice - entryPrice) * matchedQty * factor).toFixed(2));

            closedTrades.push({
              id: `matched-${sym}-${openFill.orderId}-${order.orderId}-${Math.random().toString(36).substr(2, 5)}`,
              stockName: order.stockName,
              stockSymbol: sym,
              direction: openFill.direction,
              timeFrame: "Daily",
              entryPrice,
              exitPrice,
              quantity: matchedQty,
              tradeDate: order.date,
              tradeTime: order.time,
              strategyUsed: "Technical Breakout",
              reasonForTrade: "System Matched Order",
              confidenceLevel: ConfidenceLevel.MEDIUM,
              pnl,
              holdingTimeMinutes: holdingMinutes,
              emotion: EmotionType.NEUTRAL,
              isin: order.isin,
              exchange: order.exchange,
              orderId: order.orderId,
              orderStatus: "Executed",
              clientName,
              clientId
            });

            remainingQty -= matchedQty;
            openFill.qty -= matchedQty;

            if (openFill.qty === 0) {
              queue.shift(); // fully matched fill
            }
          }

          // If there is leftover opposite quantity, create a new open fill in queue
          if (remainingQty > 0) {
            queue.push({
              price: order.price,
              qty: remainingQty,
              date: order.date,
              time: order.time,
              direction: order.direction,
              orderId: order.orderId
            });
          }
        }
      }
    }

    if (closedTrades.length === 0) {
      throw new Error("Parsed successfully, but could not match open BUY and SELL orders into closed trade positions. Ensure your report contains both BUY and SELL transactions to evaluateclosed loops.");
    }

    return closedTrades;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file: File) => {
    setErrorMsg(null);
    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
    
    const reader = new FileReader();
    if (isExcel) {
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          if (!worksheet) {
            throw new Error("No worksheets found in the Excel workbook.");
          }
          const csvText = XLSX.utils.sheet_to_csv(worksheet);
          const trades = parseCSVData(csvText);
          onDataLoaded(trades, file.name);
        } catch (err: any) {
          console.error("Excel conversion error:", err);
          setErrorMsg(err.message || "Error reading Excel file. Ensure it contains a valid order list.");
        }
      };
      reader.onerror = () => setErrorMsg("Excel file reading error.");
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const trades = parseCSVData(text);
          onDataLoaded(trades, file.name);
        } catch (err: any) {
          setErrorMsg(err.message || "Error reading CSV file.");
        }
      };
      reader.onerror = () => setErrorMsg("CSV file reading error.");
      reader.readAsText(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handlePasteSubmit = () => {
    if (!pastedCSV.trim()) return;
    try {
      setErrorMsg(null);
      const trades = parseCSVData(pastedCSV);
      onDataLoaded(trades, "Pasted Trade Log");
    } catch (err: any) {
      setErrorMsg(err.message || "Error parsing pasted CSV.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-16 px-4 flex flex-col items-center justify-center min-h-[75vh]" id="upload-view-container">
      {/* Premium minimal title & subtitle */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-black text-[#0e1118] tracking-tight">
            zentra <span className="text-slate-400 font-normal">tradeMind</span>
          </h1>
        </div>
        <p className="text-xs font-bold tracking-widest text-slate-400 uppercase font-mono">
          YOUR AI TRADING BEHAVIOR COACH
        </p>
        <p className="text-slate-500 mt-4 max-w-lg mx-auto text-sm md:text-base leading-relaxed">
          Upload your previous trading ledger (CSV or Excel) and let AI map your behavioral patterns, cognitive triggers, and risk streaks.
        </p>
      </div>

      <div className="w-full bg-white border border-slate-200/80 rounded-3xl p-8 md:p-10 shadow-md relative overflow-hidden">
        {/* Amber top line */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-500"></div>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={triggerFileSelect}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center ${
            isDragging 
              ? "border-amber-500 bg-amber-50/50 scale-[0.99]" 
              : "border-slate-200 hover:border-[#11131e]/50 hover:bg-slate-50/50"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv,.xlsx,.xls"
            className="hidden"
          />
          <div className="bg-amber-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-5 border border-amber-100">
            <Upload className="w-8 h-8 text-amber-600" />
          </div>
          <p className="text-[#0e1118] font-bold text-lg">Upload Trading Report</p>
          <p className="text-xs text-slate-400 mt-2">
            Click to select or drag and drop your report file
          </p>
        </div>

        {/* Formats info bar */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 font-medium">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">Supported formats:</span>
          <span className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
            <Check className="w-3.5 h-3.5" /> CSV / Ledger Text
          </span>
          <span className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
            <Check className="w-3.5 h-3.5" /> Excel Sheets
          </span>
        </div>

        {/* Toggle manual paste */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between items-center text-xs">
          <button 
            type="button"
            onClick={() => setShowPasteArea(!showPasteArea)} 
            className="text-[#11131e] hover:underline font-bold transition cursor-pointer"
          >
            {showPasteArea ? "Hide Paste Block" : "Or paste raw CSV text instead"}
          </button>
          <div className="flex items-center gap-1.5 text-slate-400 font-medium">
            <HelpCircle className="w-4 h-4 text-slate-300" />
            <span>Format auto-mapped</span>
          </div>
        </div>

        {showPasteArea && (
          <div className="mt-5 space-y-3.5">
            <textarea
              value={pastedCSV}
              onChange={(e) => setPastedCSV(e.target.value)}
              placeholder="Name,Client ID,Symbol,Stock Name,Type,Quantity,Value,Execution Date and Time,Order Status&#10;Bhuvan Jindal,101968,AAPL,Apple Inc,BUY,10,175.50,2026-06-15 10:30,Completed&#10;Bhuvan Jindal,101968,AAPL,Apple Inc,SELL,10,185.00,2026-06-15 11:30,Completed"
              rows={5}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs font-mono text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400 focus:bg-white"
            />
            <button
              type="button"
              onClick={handlePasteSubmit}
              disabled={!pastedCSV.trim()}
              className="w-full py-2.5 bg-[#11131e] hover:bg-black text-white disabled:opacity-50 font-bold rounded-xl text-xs transition cursor-pointer shadow-sm"
            >
              Analyze Pasted Log
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="mt-5 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-600 text-xs leading-relaxed">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
            <div>
              <span className="font-bold">Log Parser Error:</span> {errorMsg}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
