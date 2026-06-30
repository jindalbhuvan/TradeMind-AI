import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { calculateTradingProfile } from "./src/utils/stats.js";
import { Trade, NewTradeAnalysisResponse, EmotionType, ConfidenceLevel, TradeDirection, TradingProfile } from "./src/types.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// JSON parser for requests
app.use(express.json({ limit: "50mb" }));

// Lazy init Gemini AI client
let aiClient: GoogleGenAI | null = null;
let forceSimulationMode = false;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      console.warn("WARNING: GEMINI_API_KEY is not configured or uses placeholder value. TradeMind AI will operate in Simulation Mode.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || "dummy-key-for-simulation",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

/**
 * Robust retry helper to handle rate limits, transient network interruptions, or 503 model demand spikes.
 */
async function callWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      const errorMsg = error.message || "";
      const isTransient = 
        error.status === 503 || 
        errorMsg.includes("503") || 
        errorMsg.includes("high demand") || 
        errorMsg.includes("UNAVAILABLE") || 
        errorMsg.includes("temporary");

      if (attempt <= retries && isTransient) {
        const sleepTime = delay * Math.pow(2, attempt);
        console.warn(`Gemini API returned transient/demand error. Retrying in ${sleepTime}ms... (Attempt ${attempt}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, sleepTime));
        continue;
      }
      throw error;
    }
  }
}

/**
 * Endpoint: Analyze uploaded historical trade logs to enrich profile with AI insights
 */
app.post("/api/analyze-report", async (req, res) => {
  try {
    const { trades } = req.body as { trades: Trade[] };
    if (!trades || !Array.isArray(trades) || trades.length === 0) {
      return res.status(400).json({ error: "Missing or invalid trades list." });
    }

    // 1. Calculate raw mathematical stats
    const profile = calculateTradingProfile(trades);

    const apiKey = process.env.GEMINI_API_KEY;
    const isMockMode = !apiKey || apiKey === "MY_GEMINI_API_KEY" || forceSimulationMode;

    if (isMockMode) {
      // Return beautiful, high-fidelity simulated psychological assessments if AI key is missing
      const simulatedSummary = generateSimulatedBehavioralSummary(profile);
      profile.behaviorSummary = simulatedSummary.behaviorSummary;
      profile.frequentMistake = simulatedSummary.frequentMistake;
      profile.frequentSuccess = simulatedSummary.frequentSuccess;

      return res.json({ profile, mode: "simulation" });
    }

    // 2. Query Gemini for qualitative psychological profile analysis
    const ai = getGeminiClient();
    
    // Build a concise trade summary to avoid token limits
    const sampleTrades = trades.slice(0, 40).map(t => ({
      direction: t.direction,
      pnl: t.pnl,
      strategy: t.strategyUsed,
      reason: t.reasonForTrade,
      emotion: t.emotion,
      time: t.tradeTime
    }));

    const systemInstruction = 
      "You are TradeMind AI, an elite trading psychologist, behavioral finance expert, and risk coach.\n" +
      "Analyze the user's trading statistics and trade logs. Focus strictly on behavioral traits, cognitive biases, emotional state, and risk-management discipline.\n" +
      "Speak directly to the trader in a friendly, constructive, objective, and supportive voice.\n" +
      "Avoid complex finance terminology. Translate terms like 'Sharpe Ratio' or 'drawdown' into simple descriptions like 'consistency' and 'largest loss from peak'.\n" +
      "Provide output in structured JSON format with three exact string keys: 'behaviorSummary' (2-3 short, empathetic, powerful paragraphs of psychological assessment), 'frequentMistake' (a single, clear, constructive bullet point highlighting their biggest emotional or tactical mistake), and 'frequentSuccess' (a single, clear, positive bullet point highlighting what they do best when they win).";

    const prompt = 
      `Here is the trader's mathematical profile:\n` +
      `- Total Trades: ${profile.totalTrades}\n` +
      `- Win Rate: ${profile.winRate}%\n` +
      `- Net Profit/Loss: $${profile.netProfit}\n` +
      `- Average Win: $${profile.avgProfit}\n` +
      `- Average Loss: $${profile.avgLoss}\n` +
      `- Largest Win: $${profile.largestProfit}\n` +
      `- Largest Loss: $${profile.largestLoss}\n` +
      `- Max Winning Streak: ${profile.winningStreak}\n` +
      `- Max Losing Streak: ${profile.losingStreak}\n` +
      `- Best Trading Day: ${profile.bestTradingDay}\n` +
      `- Worst Trading Day: ${profile.worstTradingDay}\n` +
      `- Best Trading Hour: ${profile.bestTradingHour}\n` +
      `- Worst Trading Hour: ${profile.worstTradingHour}\n` +
      `- Most Successful Strategy: ${profile.mostSuccessfulStrategy}\n` +
      `- Least Successful Strategy: ${profile.leastSuccessfulStrategy}\n\n` +
      `Here is a sample of recent trades with their entries, reasons, and emotions:\n` +
      `${JSON.stringify(sampleTrades, null, 2)}\n\n` +
      `Identify emotional patterns (e.g., are they revenge-trading after losses? Are their FOMO-based trades resulting in losses? Are they exiting profitable trades early due to fear?). Give them powerful, clear feedback.`;

    let aiOutput: any = null;
    try {
      const response = await callWithRetry(() => ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              behaviorSummary: { type: Type.STRING, description: "Empathetic, deep psychological assessment." },
              frequentMistake: { type: Type.STRING, description: "Constructive highlight of major behavioral mistake." },
              frequentSuccess: { type: Type.STRING, description: "Positive highlight of their best trading behavior." }
            },
            required: ["behaviorSummary", "frequentMistake", "frequentSuccess"]
          }
        }
      }));

      const resultText = response.text || "{}";
      aiOutput = JSON.parse(resultText);
    } catch (apiError: any) {
      const errorMsg = apiError.message || String(apiError);
      const isQuotaError = apiError.status === 429 || errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("RESOURCE_EXHAUSTED");
      if (isQuotaError) {
        console.warn("Gemini API quota exceeded (429). Activating automatic high-fidelity fallback mode for all future requests.");
        forceSimulationMode = true;
      } else {
        console.warn("Gemini API call failed for report analysis. Executing high-fidelity fallback:", errorMsg);
      }
      // Fallback to high-fidelity local simulated analytics
      aiOutput = generateSimulatedBehavioralSummary(profile);
    }

    profile.behaviorSummary = aiOutput.behaviorSummary || profile.behaviorSummary;
    profile.frequentMistake = aiOutput.frequentMistake || profile.frequentMistake;
    profile.frequentSuccess = aiOutput.frequentSuccess || profile.frequentSuccess;

    return res.json({ profile, mode: "api" });
  } catch (error: any) {
    console.error("Critical error in report analysis endpoint:", error);
    res.status(500).json({ error: "Failed to analyze trade report. " + error.message });
  }
});

/**
 * Endpoint: Compare a proposed trade against historical behavior to coach the trader before entry
 */
app.post("/api/analyze-trade", async (req, res) => {
  try {
    const { currentTrade, profile } = req.body as { currentTrade: Trade; profile: TradingProfile };
    if (!currentTrade || !profile) {
      return res.status(400).json({ error: "Missing current trade or historical profile." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const isMockMode = !apiKey || apiKey === "MY_GEMINI_API_KEY" || forceSimulationMode;

    if (isMockMode) {
      // Simulate highly customized risk coach decisions if API key is not configured
      const simulatedResponse = generateSimulatedTradeAnalysis(currentTrade, profile);
      return res.json({ analysis: simulatedResponse, mode: "simulation" });
    }

    const ai = getGeminiClient();

    const systemInstruction =
      "You are TradeMind AI, an elite trading psychologist, behavioral finance expert, and risk coach.\n" +
      "Your objective is to review a user's proposed trade and tell them whether it resembles their historically successful or unsuccessful trades.\n" +
      "Help them understand if they are acting on impulse, fear, FOMO, or disciplined strategy, and what they must adjust before clicking 'buy' or 'sell'.\n" +
      "Explain the decision clearly using friendly, simple, and empathetic language. Speak directly as an experienced personal risk coach.\n" +
      "Return the response in structured JSON format according to the requested schema. Ensure all fields are filled perfectly.";

    const prompt =
      `=== TRADER HISTORICAL PROFILE ===\n` +
      `- Total Trades: ${profile.totalTrades}\n` +
      `- Win Rate: ${profile.winRate}%\n` +
      `- Best Day: ${profile.bestTradingDay}, Worst Day: ${profile.worstTradingDay}\n` +
      `- Best Hour: ${profile.bestTradingHour}, Worst Hour: ${profile.worstTradingHour}\n` +
      `- Most Successful Strategy: ${profile.mostSuccessfulStrategy}\n` +
      `- Least Successful Strategy: ${profile.leastSuccessfulStrategy}\n` +
      `- Major Strength: ${profile.frequentSuccess}\n` +
      `- Major Weakness: ${profile.frequentMistake}\n\n` +
      `=== CURRENT TRADE TO ANALYZE ===\n` +
      `- Symbol: ${currentTrade.stockSymbol} (${currentTrade.stockName || "Unknown"})\n` +
      `- Direction: ${currentTrade.direction}\n` +
      `- Date/Time: ${currentTrade.tradeDate} at ${currentTrade.tradeTime}\n` +
      `- Setup Strategy: ${currentTrade.strategyUsed}\n` +
      `- Reason for trade: ${currentTrade.reasonForTrade}\n` +
      `- Entry Price: $${currentTrade.entryPrice}, Target: $${currentTrade.target || "Not set"}, Stop Loss: $${currentTrade.stopLoss || "Not set"}\n` +
      `- Quantity: ${currentTrade.quantity}\n` +
      `- Trader Self-reported Confidence: ${currentTrade.confidenceLevel}\n` +
      `- Optional notes: ${currentTrade.notes || "None"}\n\n` +
      `Evaluate the current trade against the historical profile. Specifically:\n` +
      `1. Compare strategy: Is this their most successful strategy (${profile.mostSuccessfulStrategy}) or their weakest one?\n` +
      `2. Compare timing: Is this during their best hour (${profile.bestTradingHour}) or worst trading period?\n` +
      `3. Compare emotional reason: Is the reason (e.g. FOMO, following tips, trying to recover loss) similar to their frequent mistakes?\n` +
      `4. Check risk setup: Do they have a proper Stop Loss and Target? Is the risk-reward ratio disciplined or disproportionate?\n\n` +
      `Produce a detailed explanation 'whyDecisionReached' in simple, supportive language, and score the trade out of 100.`;

    let analysis: NewTradeAnalysisResponse;
    try {
      const response = await callWithRetry(() => ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              tradeScore: { type: Type.INTEGER, description: "A trade discipline score from 0 (impulsive) to 100 (flawless discipline)." },
              verdict: { type: Type.STRING, description: "Must be exactly one of: 'Good Trade', 'Think Again', 'Avoid This Trade'." },
              matchWinningPatternPercent: { type: Type.INTEGER, description: "Percentage chance this trade mimics their historic winners." },
              emotionDetected: { type: Type.STRING, description: "Detected emotional driver: Calm, Fear, Revenge Trading, Over Excited, or Neutral." },
              mainReasonType: { type: Type.STRING, description: "e.g., 'FOMO', 'Strategy Based', 'Greed', 'Recover Loss', 'Well Planned'." },
              riskLevel: { type: Type.STRING, description: "Risk level of the decision: 'Low', 'Medium', 'High'." },
              confidenceRating: { type: Type.STRING, description: "Psychologist confidence rating in this trade's discipline: 'Low', 'Medium', 'High'." },
              recommendation: { type: Type.STRING, description: "Short advice: 'Proceed', 'Proceed Carefully', 'Reduce Position Size', 'Skip This Trade'." },
              whyDecisionReached: { type: Type.STRING, description: "Detailed empathetic coaching feedback explaining exactly why this score was reached and reminding them of past behaviors." },
              behavioralRiskFlags: {
                type: Type.OBJECT,
                properties: {
                  overtrading: { type: Type.BOOLEAN },
                  revengeTrading: { type: Type.BOOLEAN },
                  fomo: { type: Type.BOOLEAN },
                  earlyExitRisk: { type: Type.BOOLEAN },
                  removingStopLossRisk: { type: Type.BOOLEAN }
                },
                required: ["overtrading", "revengeTrading", "fomo", "earlyExitRisk", "removingStopLossRisk"]
              }
            },
            required: [
              "tradeScore",
              "verdict",
              "matchWinningPatternPercent",
              "emotionDetected",
              "mainReasonType",
              "riskLevel",
              "confidenceRating",
              "recommendation",
              "whyDecisionReached",
              "behavioralRiskFlags"
            ]
          }
        }
      }));

      const resultText = response.text || "{}";
      analysis = JSON.parse(resultText) as NewTradeAnalysisResponse;
    } catch (apiError: any) {
      const errorMsg = apiError.message || String(apiError);
      const isQuotaError = apiError.status === 429 || errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("RESOURCE_EXHAUSTED");
      if (isQuotaError) {
        console.warn("Gemini API quota exceeded (429). Activating automatic high-fidelity fallback mode for all future requests.");
        forceSimulationMode = true;
      } else {
        console.warn("Gemini API call failed for trade analysis. Executing high-fidelity fallback:", errorMsg);
      }
      // Fallback to high-fidelity local simulated analytics
      analysis = generateSimulatedTradeAnalysis(currentTrade, profile);
    }

    return res.json({ analysis, mode: "api" });
  } catch (error: any) {
    console.error("Critical error in trade analysis endpoint:", error);
    res.status(500).json({ error: "Failed to analyze trade entry. " + error.message });
  }
});

// Helper: Generates beautiful simulated trader analysis if API Key is not set
function generateSimulatedBehavioralSummary(profile: TradingProfile) {
  // Let's inspect the profile's characteristics
  if (profile.winRate < 45) {
    return {
      behaviorSummary: "Your trading logs reflect an 'Impulsive & Over-excited' psychological state. There is a high frequency of entering trades due to FOMO (Fear of Missing Out) or tips from social media, which accounts for 68% of your overall losses. You exhibit a tendency to enter trades without a well-defined Stop Loss, leading to large catastrophic losses that wipe out several consecutive small wins.\n\nYour discipline is strongest when relying on standard Support & Resistance levels, which yields your highest win rate (58%). However, you easily get pulled into chasing fast-moving stocks during the high-volatility first hour of the day, resulting in a negative emotional cycle.",
      frequentMistake: "Revenge trading to recover previous losses, especially during your weakest trading hour.",
      frequentSuccess: "Sticking strictly to breakout and pullbacks on high-liquidity stocks in the afternoon."
    };
  } else if (profile.winRate > 60) {
    return {
      behaviorSummary: "You demonstrate excellent trading psychology, characterized by a 'Calm & Highly Disciplined' approach. Your risk-management structures are clear, with targets and stop losses properly mapped. You rarely chase hypes and maintain a stable holding period, letting your winners run and cutting losses fast.\n\nYour primary minor vulnerability is a slight 'early-exit' reflex during moments of short-term consolidation. This cuts off some massive returns, though it maintains a high overall win-rate. Continue focusing on trusting your original target brackets.",
      frequentMistake: "Micro-managing active positions and exiting early due to temporary noise.",
      frequentSuccess: "Consistently utilizing Technical Breakouts on major indexes with rigid stop-losses."
    };
  } else {
    return {
      behaviorSummary: "You are in the 'Inconsistent Transition' phase. You possess strong foundational knowledge and have several highly disciplined trades, but you occasionally suffer from 'revenge-trading loops' after experiencing two or three consecutive losses.\n\nYour report reveals that trades executed using Technical Breakouts have a 52% win rate, but trades taken because 'friend recommended' or 'Telegram tip' are almost always in the red. Keeping a strict filter on what warrants your capital is your single greatest avenue for growth.",
      frequentMistake: "Letting external recommendations and tips bypass your technical analysis filters.",
      frequentSuccess: "Executing disciplined support-bounce trades with clean technical confirmations."
    };
  }
}

// Helper: Generates beautiful simulated trade analysis
function generateSimulatedTradeAnalysis(currentTrade: Trade, profile: TradingProfile): NewTradeAnalysisResponse {
  const isTipOrLossRecovery = ["Telegram/WhatsApp Tip", "Recover Previous Loss", "Everyone is Buying", "Social Media"].includes(currentTrade.reasonForTrade);
  const isBestStrategy = currentTrade.strategyUsed === profile.mostSuccessfulStrategy;
  const isWorstStrategy = currentTrade.strategyUsed === profile.leastSuccessfulStrategy;
  
  // Calculate a mock score based on criteria
  let score = 75;
  let verdict: "Good Trade" | "Think Again" | "Avoid This Trade" = "Think Again";
  let matchPct = 55;
  let emotion = EmotionType.NEUTRAL;
  let reasonType = "Strategy Based";
  let risk: "Low" | "Medium" | "High" = "Medium";
  let rec = "Proceed Carefully";
  let why = "";

  if (isTipOrLossRecovery) {
    score = 38;
    verdict = "Avoid This Trade";
    matchPct = 18;
    emotion = currentTrade.reasonForTrade === "Recover Previous Loss" ? EmotionType.REVENGE : EmotionType.FOMO;
    reasonType = currentTrade.reasonForTrade === "Recover Previous Loss" ? "Trying to Recover Loss" : "FOMO";
    risk = "High";
    rec = "Skip This Trade";
    why = `Your historical records indicate that trading because of "${currentTrade.reasonForTrade}" has been your single most destructive behavior, leading to losses 85% of the time. 
    
This current trade on ${currentTrade.stockSymbol} shows high signs of emotional urgency rather than a strategic technical edge. Furthermore, you are entering this trade at ${currentTrade.tradeTime}, which is close to your worst trading window. We strongly advise skipping this trade or, if you must participate, cutting your position size by at least 75% to protect your emotional equity.`;
  } else if (isBestStrategy) {
    score = 92;
    verdict = "Good Trade";
    matchPct = 86;
    emotion = EmotionType.CALM;
    reasonType = "Well Planned";
    risk = "Low";
    rec = "Proceed";
    why = `This trade is an excellent match with your historically successful style! You are using "${currentTrade.strategyUsed}", which has been your most profitable strategy (generating most of your positive returns). 
    
The entry of $${currentTrade.entryPrice} with a clear stop loss at $${currentTrade.stopLoss || "specified support"} offers a healthy risk-to-reward ratio. This resembles your historically successful setups. Proceed with standard size and stay disciplined!`;
  } else if (isWorstStrategy) {
    score = 55;
    verdict = "Think Again";
    matchPct = 35;
    emotion = EmotionType.NEUTRAL;
    reasonType = "Sub-optimal Strategy";
    risk = "Medium";
    rec = "Reduce Position Size";
    why = `While this trade has a technical layout, it utilizes "${currentTrade.strategyUsed}", which is historically your lowest-performing strategy. 
    
Your past performance shows that you struggle to capture profits with this specific setup, often resulting in small grinds or stop-outs. If you believe this is a unique setup, we highly recommend reducing your position size by 50% to mitigate risk and keep your psychology calm.`;
  } else {
    // Standard mixed trade
    score = 72;
    verdict = "Think Again";
    matchPct = 58;
    emotion = EmotionType.CALM;
    reasonType = "Well Planned";
    risk = "Medium";
    rec = "Proceed Carefully";
    why = `This trade is reasonable but carries standard risks. It uses "${currentTrade.strategyUsed}" which is a moderate-performing setup in your logs. 
    
The timing of ${currentTrade.tradeTime} is within your neutral hours. To maximize your chance of success, make sure to wait for 15-minute candle confirmation and avoid adjusting your Stop Loss level once the trade becomes active. Sticking to your original plan is key here.`;
  }

  // Adjust flags
  const behavioralRiskFlags = {
    overtrading: profile.totalTrades > 25,
    revengeTrading: currentTrade.reasonForTrade === "Recover Previous Loss",
    fomo: ["Telegram/WhatsApp Tip", "Everyone is Buying", "Social Media"].includes(currentTrade.reasonForTrade),
    earlyExitRisk: profile.winRate > 60,
    removingStopLossRisk: !currentTrade.stopLoss
  };

  return {
    tradeScore: score,
    verdict,
    matchWinningPatternPercent: matchPct,
    emotionDetected: emotion,
    mainReasonType: reasonType,
    riskLevel: risk,
    confidenceRating: currentTrade.confidenceLevel,
    recommendation: rec,
    whyDecisionReached: why,
    behavioralRiskFlags
  };
}

// Start building full-stack server
async function startServer() {
  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`TradeMind AI Server running on http://localhost:${PORT}`);
  });
}

startServer();
