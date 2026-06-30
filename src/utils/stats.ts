import { Trade, TradingProfile, TradeDirection, EmotionType, InstrumentType } from "../types.js";

/**
 * Calculates complete trading statistics from a list of trades
 */
export function calculateTradingProfile(trades: Trade[]): TradingProfile {
  const totalTrades = trades.length;
  if (totalTrades === 0) {
    return createEmptyProfile();
  }

  const winningTrades = trades.filter((t) => t.pnl > 0);
  const losingTrades = trades.filter((t) => t.pnl <= 0);

  const winRate = Math.round((winningTrades.length / totalTrades) * 100);
  const netProfit = Number(trades.reduce((sum, t) => sum + t.pnl, 0).toFixed(2));

  const avgProfit = winningTrades.length > 0
    ? Number((winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length).toFixed(2))
    : 0;

  const avgLoss = losingTrades.length > 0
    ? Number((losingTrades.reduce((sum, t) => sum + Math.abs(t.pnl), 0) / losingTrades.length).toFixed(2))
    : 0;

  // Largest wins and losses
  let largestProfit = 0;
  let largestLoss = 0;
  trades.forEach((t) => {
    if (t.pnl > largestProfit) largestProfit = t.pnl;
    if (t.pnl < largestLoss) largestLoss = t.pnl;
  });

  // Streaks
  let currentWinStreak = 0;
  let maxWinStreak = 0;
  let currentLossStreak = 0;
  let maxLossStreak = 0;

  // Sorted chronologically to calculate streaks correctly
  const sortedTrades = [...trades].sort((a, b) => {
    const dateTimeA = new Date(`${a.tradeDate}T${a.tradeTime || "00:00"}`).getTime();
    const dateTimeB = new Date(`${b.tradeDate}T${b.tradeTime || "00:00"}`).getTime();
    return dateTimeA - dateTimeB;
  });

  sortedTrades.forEach((t) => {
    if (t.pnl > 0) {
      currentWinStreak++;
      currentLossStreak = 0;
      if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
    } else {
      currentLossStreak++;
      currentWinStreak = 0;
      if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
    }
  });

  // Calculate average Risk Reward Ratio
  // If target and stop loss are provided, we calculate R:R on setup: (Target - Entry) / (Entry - Stop)
  // Otherwise, we default to the ratio of average win to average loss.
  let totalRR = 0;
  let rrCount = 0;
  trades.forEach((t) => {
    if (t.entryPrice && t.stopLoss && t.target) {
      const risk = Math.abs(t.entryPrice - t.stopLoss);
      const reward = Math.abs(t.target - t.entryPrice);
      if (risk > 0) {
        totalRR += reward / risk;
        rrCount++;
      }
    }
  });

  const avgRiskReward = rrCount > 0
    ? Number((totalRR / rrCount).toFixed(2))
    : (avgLoss > 0 ? Number((avgProfit / avgLoss).toFixed(2)) : 1.5);

  const avgHoldingTimeMinutes = trades.length > 0
    ? Math.round(trades.reduce((sum, t) => sum + (t.holdingTimeMinutes || 30), 0) / totalTrades)
    : 45;

  // Monthly Performance Mapping
  const monthlyMap: Record<string, number> = {};
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  trades.forEach((t) => {
    const date = new Date(t.tradeDate + "T12:00:00"); // avoid local timezone shift
    if (!isNaN(date.getTime())) {
      const monthStr = monthNames[date.getMonth()];
      monthlyMap[monthStr] = (monthlyMap[monthStr] || 0) + t.pnl;
    }
  });

  const monthlyPnL = monthNames.map((month) => ({
    month,
    pnl: Number((monthlyMap[month] || 0).toFixed(2))
  })).filter(m => m.pnl !== 0 || trades.some(t => {
    const d = new Date(t.tradeDate + "T12:00:00");
    return monthNames[d.getMonth()] === m.month;
  }));

  // Day of Week Performance Mapping
  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayMap: Record<string, { pnl: number; count: number }> = {};
  daysOfWeek.forEach((day) => {
    dayMap[day] = { pnl: 0, count: 0 };
  });

  trades.forEach((t) => {
    const date = new Date(t.tradeDate + "T12:00:00");
    if (!isNaN(date.getTime())) {
      const dayName = daysOfWeek[date.getDay()];
      dayMap[dayName].pnl += t.pnl;
      dayMap[dayName].count += 1;
    }
  });

  const dayOfWeekPnL = daysOfWeek.map((day) => ({
    day,
    pnl: Number(dayMap[day].pnl.toFixed(2)),
    count: dayMap[day].count
  })).filter(d => d.count > 0);

  // Hourly Performance Mapping (bucketed into blocks or single hours)
  const hourMap: Record<string, { pnl: number; count: number }> = {};
  trades.forEach((t) => {
    const timeParts = t.tradeTime ? t.tradeTime.split(":") : ["10", "00"];
    const hour = `${timeParts[0]}:00`;
    if (!hourMap[hour]) {
      hourMap[hour] = { pnl: 0, count: 0 };
    }
    hourMap[hour].pnl += t.pnl;
    hourMap[hour].count += 1;
  });

  const hourlyPnL = Object.entries(hourMap).map(([hour, data]) => ({
    hour,
    pnl: Number(data.pnl.toFixed(2)),
    count: data.count
  })).sort((a, b) => a.hour.localeCompare(b.hour));

  // Strategy Analysis
  const strategyMap: Record<string, { pnl: number; wins: number; count: number }> = {};
  trades.forEach((t) => {
    const strategy = t.strategyUsed || "Unknown Strategy";
    if (!strategyMap[strategy]) {
      strategyMap[strategy] = { pnl: 0, wins: 0, count: 0 };
    }
    strategyMap[strategy].pnl += t.pnl;
    strategyMap[strategy].count += 1;
    if (t.pnl > 0) strategyMap[strategy].wins += 1;
  });

  const strategyPnL = Object.entries(strategyMap).map(([strategy, data]) => ({
    strategy,
    pnl: Number(data.pnl.toFixed(2)),
    winRate: Math.round((data.wins / data.count) * 100),
    count: data.count
  })).sort((a, b) => b.pnl - a.pnl);

  // Reason Analysis
  const reasonMap: Record<string, { pnl: number; wins: number; count: number }> = {};
  trades.forEach((t) => {
    const reason = t.reasonForTrade || "Other";
    if (!reasonMap[reason]) {
      reasonMap[reason] = { pnl: 0, wins: 0, count: 0 };
    }
    reasonMap[reason].pnl += t.pnl;
    reasonMap[reason].count += 1;
    if (t.pnl > 0) reasonMap[reason].wins += 1;
  });

  const reasonPnL = Object.entries(reasonMap).map(([reason, data]) => ({
    reason,
    pnl: Number(data.pnl.toFixed(2)),
    winRate: Math.round((data.wins / data.count) * 100),
    count: data.count
  })).sort((a, b) => b.pnl - a.pnl);

  // Emotion Analysis
  const emotionMap: Record<string, { pnl: number; count: number }> = {};
  trades.forEach((t) => {
    const emotion = t.emotion || EmotionType.NEUTRAL;
    if (!emotionMap[emotion]) {
      emotionMap[emotion] = { pnl: 0, count: 0 };
    }
    emotionMap[emotion].pnl += t.pnl;
    emotionMap[emotion].count += 1;
  });

  const emotionPnL = Object.entries(emotionMap).map(([emotion, data]) => ({
    emotion,
    pnl: Number(data.pnl.toFixed(2)),
    count: data.count
  }));

  // Identify Best and Worst Day/Hour/Strategy
  let bestTradingDay = "N/A";
  let worstTradingDay = "N/A";
  let highestDayPnL = -Infinity;
  let lowestDayPnL = Infinity;

  dayOfWeekPnL.forEach((d) => {
    if (d.pnl > highestDayPnL) {
      highestDayPnL = d.pnl;
      bestTradingDay = d.day;
    }
    if (d.pnl < lowestDayPnL) {
      lowestDayPnL = d.pnl;
      worstTradingDay = d.day;
    }
  });

  let bestTradingHour = "N/A";
  let worstTradingHour = "N/A";
  let highestHourPnL = -Infinity;
  let lowestHourPnL = Infinity;

  hourlyPnL.forEach((h) => {
    if (h.pnl > highestHourPnL) {
      highestHourPnL = h.pnl;
      bestTradingHour = h.hour;
    }
    if (h.pnl < lowestHourPnL) {
      lowestHourPnL = h.pnl;
      worstTradingHour = h.hour;
    }
  });

  let mostSuccessfulStrategy = "N/A";
  let leastSuccessfulStrategy = "N/A";
  let highestStratPnL = -Infinity;
  let lowestStratPnL = Infinity;

  strategyPnL.forEach((s) => {
    if (s.pnl > highestStratPnL) {
      highestStratPnL = s.pnl;
      mostSuccessfulStrategy = s.strategy;
    }
    if (s.pnl < lowestStratPnL) {
      lowestStratPnL = s.pnl;
      leastSuccessfulStrategy = s.strategy;
    }
  });

  // Set default insights before AI enhances them
  const frequentMistake = losingTrades.length > 0 
    ? "Exiting trades early due to fear or entering trades on recommendations." 
    : "None detected.";
  
  const frequentSuccess = winningTrades.length > 0
    ? "Entering breakout positions with clear support and resistance levels."
    : "None detected.";

  const behaviorSummary = "Calculating behavioral patterns. Connect to TradeMind AI Psychologist for rich feedback.";

  // Extract client metadata from trades if present
  let clientName = "";
  let clientId = "";
  for (const t of trades) {
    if ((t as any).clientName) clientName = (t as any).clientName;
    if ((t as any).clientId) clientId = (t as any).clientId;
    if (clientName && clientId) break;
  }

  // Calculate period from and to dates based on sorted trades
  let periodFrom = "N/A";
  let periodTo = "N/A";
  if (sortedTrades.length > 0) {
    periodFrom = sortedTrades[0].tradeDate;
    periodTo = sortedTrades[sortedTrades.length - 1].tradeDate;
  }

  // --- F&O STATS CALCULATIONS ---
  const equityTrades = trades.filter(t => detectInstrumentType(t) === InstrumentType.EQUITY);
  const futuresTrades = trades.filter(t => detectInstrumentType(t) === InstrumentType.FUTURES);
  const optionsTrades = trades.filter(t => detectInstrumentType(t) === InstrumentType.OPTIONS);

  const equityWinRate = equityTrades.length > 0 
    ? Math.round((equityTrades.filter(t => t.pnl > 0).length / equityTrades.length) * 100) 
    : undefined;

  const futuresWinRate = futuresTrades.length > 0 
    ? Math.round((futuresTrades.filter(t => t.pnl > 0).length / futuresTrades.length) * 100) 
    : undefined;

  const optionsWinRate = optionsTrades.length > 0 
    ? Math.round((optionsTrades.filter(t => t.pnl > 0).length / optionsTrades.length) * 100) 
    : undefined;

  // Best/Worst instrument based on total cumulative PnL
  const instrumentPnL: Record<string, number> = {};
  trades.forEach(t => {
    const sym = t.stockSymbol.toUpperCase();
    instrumentPnL[sym] = (instrumentPnL[sym] || 0) + t.pnl;
  });

  let bestInstrument = "N/A";
  let worstInstrument = "N/A";
  let maxInstPnL = -Infinity;
  let minInstPnL = Infinity;

  Object.entries(instrumentPnL).forEach(([sym, pnl]) => {
    if (pnl > maxInstPnL) {
      maxInstPnL = pnl;
      bestInstrument = sym;
    }
    if (pnl < minInstPnL) {
      minInstPnL = pnl;
      worstInstrument = sym;
    }
  });

  // If there are no positive pnl instruments, set best to N/A or first
  if (maxInstPnL <= 0 && bestInstrument !== "N/A") {
    // If all instruments lost money, bestInstrument is still the one that lost the least
  }

  // Best Expiry Type (Weekly vs Monthly)
  let weeklyPnL = 0;
  let monthlyPnLVal = 0;
  let weeklyCount = 0;
  let monthlyCount = 0;

  trades.forEach(t => {
    const exp = detectExpiryType(t);
    if (exp === "Weekly") {
      weeklyPnL += t.pnl;
      weeklyCount++;
    } else if (exp === "Monthly") {
      monthlyPnLVal += t.pnl;
      monthlyCount++;
    }
  });

  let bestExpiryType = "N/A";
  if (weeklyCount > 0 || monthlyCount > 0) {
    if (weeklyPnL > monthlyPnLVal && weeklyCount > 0) {
      bestExpiryType = "Weekly";
    } else if (monthlyPnLVal > weeklyPnL && monthlyCount > 0) {
      bestExpiryType = "Monthly";
    } else if (weeklyCount > 0) {
      bestExpiryType = "Weekly";
    } else {
      bestExpiryType = "Monthly";
    }
  }

  // Best Option Type (CE vs PE)
  let cePnL = 0;
  let pePnL = 0;
  let ceCount = 0;
  let peCount = 0;

  trades.forEach(t => {
    const optType = detectOptionType(t);
    if (optType === "CE") {
      cePnL += t.pnl;
      ceCount++;
    } else if (optType === "PE") {
      pePnL += t.pnl;
      peCount++;
    }
  });

  let bestOptionType = "N/A";
  if (ceCount > 0 || peCount > 0) {
    if (cePnL > pePnL && ceCount > 0) {
      bestOptionType = "CE";
    } else if (pePnL > cePnL && peCount > 0) {
      bestOptionType = "PE";
    } else if (ceCount > 0) {
      bestOptionType = "CE";
    } else {
      bestOptionType = "PE";
    }
  }

  return {
    totalTrades,
    winRate,
    netProfit,
    avgProfit,
    avgLoss,
    avgRiskReward,
    avgHoldingTimeMinutes,
    largestProfit,
    largestLoss,
    winningStreak: maxWinStreak,
    losingStreak: maxLossStreak,
    monthlyPnL,
    dayOfWeekPnL,
    hourlyPnL,
    strategyPnL,
    reasonPnL,
    emotionPnL,
    bestTradingDay,
    worstTradingDay,
    bestTradingHour,
    worstTradingHour,
    mostSuccessfulStrategy,
    leastSuccessfulStrategy,
    frequentMistake,
    frequentSuccess,
    behaviorSummary,
    clientName: clientName || undefined,
    clientId: clientId || undefined,
    periodFrom,
    periodTo,
    equityWinRate,
    futuresWinRate,
    optionsWinRate,
    bestInstrument,
    worstInstrument,
    bestExpiryType,
    bestOptionType
  };
}

export function createEmptyProfile(): TradingProfile {
  return {
    totalTrades: 0,
    winRate: 0,
    netProfit: 0,
    avgProfit: 0,
    avgLoss: 0,
    avgRiskReward: 1.5,
    avgHoldingTimeMinutes: 0,
    largestProfit: 0,
    largestLoss: 0,
    winningStreak: 0,
    losingStreak: 0,
    monthlyPnL: [],
    dayOfWeekPnL: [],
    hourlyPnL: [],
    strategyPnL: [],
    reasonPnL: [],
    emotionPnL: [],
    bestTradingDay: "N/A",
    worstTradingDay: "N/A",
    bestTradingHour: "N/A",
    worstTradingHour: "N/A",
    mostSuccessfulStrategy: "N/A",
    leastSuccessfulStrategy: "N/A",
    frequentMistake: "No trades uploaded yet.",
    frequentSuccess: "No trades uploaded yet.",
    behaviorSummary: "Please upload your historical trade logs to generate your personal behavioral profile.",
    equityWinRate: 0,
    futuresWinRate: 0,
    optionsWinRate: 0,
    bestInstrument: "N/A",
    worstInstrument: "N/A",
    bestExpiryType: "N/A",
    bestOptionType: "N/A"
  };
}

export function detectInstrumentType(trade: Trade): InstrumentType {
  if (trade.instrumentType) return trade.instrumentType;
  
  const symbol = (trade.stockSymbol || "").toUpperCase();
  const name = (trade.stockName || "").toUpperCase();
  
  // Options indicators: CE, PE, CALL, PUT, option strike price pattern (e.g. NIFTY26JUN24000CE)
  const isOption = 
    symbol.endsWith("CE") || 
    symbol.endsWith("PE") || 
    symbol.includes(" CE") || 
    symbol.includes(" PE") || 
    name.includes("CALL") || 
    name.includes("PUT") ||
    /CE|PE/i.test(symbol) ||
    /CALL|PUT/i.test(name) ||
    /(\d{5,})\s*(CE|PE)/i.test(symbol); // strike + CE/PE
    
  if (isOption) return InstrumentType.OPTIONS;

  // Futures indicators: FUT, FUTURES, JUN FUT, etc.
  const isFuture = 
    symbol.includes("FUT") || 
    name.includes("FUT") || 
    symbol.endsWith("F") || 
    name.includes("FUTURE");
    
  if (isFuture) return InstrumentType.FUTURES;

  return InstrumentType.EQUITY;
}

export function detectOptionType(trade: Trade): "CE" | "PE" | undefined {
  if (trade.optionType) return trade.optionType;
  const symbol = (trade.stockSymbol || "").toUpperCase();
  const name = (trade.stockName || "").toUpperCase();
  if (symbol.endsWith("CE") || symbol.includes("CE ") || symbol.includes(" CE") || name.includes("CALL") || name.includes("CE")) {
    return "CE";
  }
  if (symbol.endsWith("PE") || symbol.includes("PE ") || symbol.includes(" PE") || name.includes("PUT") || name.includes("PE")) {
    return "PE";
  }
  return undefined;
}

export function detectExpiryType(trade: Trade): "Weekly" | "Monthly" | "N/A" {
  const symbol = (trade.stockSymbol || "").toUpperCase();
  const instType = detectInstrumentType(trade);
  if (instType !== InstrumentType.OPTIONS && instType !== InstrumentType.FUTURES) {
    return "N/A";
  }
  
  // Weekly options or futures typically have more specific day digits in Indian markets (e.g. NIFTY24O17)
  const hasDayDigits = /\d{2}[A-Z]{3}\d{2}/.test(symbol) || /\d{2}\d{2}\d{2}/.test(symbol) || /\d[A-Z]\d{2}/.test(symbol) || /\d{2}[A-Z]\d{2}/.test(symbol);
  if (hasDayDigits) {
    return "Weekly";
  }
  return "Monthly";
}
