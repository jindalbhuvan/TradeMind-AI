import React, { useState, useEffect } from "react";
import { Brain, Sparkles, CheckCircle2 } from "lucide-react";

interface LearningAnimationProps {
  fileName: string;
  onComplete: () => void;
}

export default function LearningAnimation({ fileName, onComplete }: LearningAnimationProps) {
  const [progress, setProgress] = useState(0);
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    "Reading Trade Report...",
    "Calculating statistics...",
    "Finding winning patterns...",
    "Finding losing patterns...",
    "Learning trading behaviour...",
    "Building AI Trading Profile..."
  ];

  useEffect(() => {
    // Total duration of 3800ms
    const totalDuration = 3800;
    const intervalTime = 50;
    const stepRatio = totalDuration / steps.length;

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + (100 / (totalDuration / intervalTime));
        if (next >= 100) {
          clearInterval(timer);
          // Wait a split second at 100% for dramatic effect, then complete
          setTimeout(() => {
            onComplete();
          }, 400);
          return 100;
        }
        
        // Calculate which text step should be highlighted based on time/progress
        const currentMs = (next / 100) * totalDuration;
        const currentStepIndex = Math.min(
          Math.floor(currentMs / stepRatio),
          steps.length - 1
        );
        setActiveStep(currentStepIndex);

        return next;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [onComplete, steps.length]);

  // Generate ASCII progress bar
  const renderProgressBar = () => {
    const totalBars = 20;
    const filledBars = Math.round((progress / 100) * totalBars);
    const emptyBars = totalBars - filledBars;
    const barString = "█".repeat(filledBars) + "░".repeat(emptyBars);
    return `${barString} ${Math.round(progress)}%`;
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[70vh] px-4 py-12" id="learning-container">
      <div className="max-w-xl w-full bg-white border border-slate-100 rounded-3xl p-8 shadow-sm relative overflow-hidden">
        {/* Subtle glowing core */}
        <div className="absolute -top-16 -left-16 w-36 h-36 bg-indigo-500/5 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-16 -right-16 w-36 h-36 bg-purple-500/5 rounded-full blur-3xl"></div>
        
        {/* Animated robot/brain icon */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="relative mb-4">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-indigo-500 to-indigo-600 blur opacity-10 animate-pulse"></div>
            <div className="relative bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex items-center justify-center">
              <Brain className="w-8 h-8 text-indigo-600 animate-pulse" />
            </div>
          </div>
          <h2 className="text-xl font-extrabold text-[#0e1118] tracking-tight flex items-center gap-1.5 justify-center">
            <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
            AI Starts Learning
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Analyzing <span className="font-mono text-indigo-600 font-semibold">{fileName}</span>
          </p>
        </div>

        {/* ASCII Console Block */}
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 font-mono text-sm leading-relaxed mb-6">
          {/* Progress bar */}
          <div className="text-indigo-600 font-bold mb-4 flex justify-between items-center select-none overflow-x-auto whitespace-nowrap scrollbar-none">
            <span>{renderProgressBar()}</span>
          </div>

          {/* Sequential Steps List */}
          <div className="space-y-2.5">
            {steps.map((step, idx) => {
              const isCompleted = idx < activeStep;
              const isActive = idx === activeStep;
              const isPending = idx > activeStep;

              return (
                <div 
                  key={idx} 
                  className={`flex items-center gap-3 transition-all duration-300 ${
                    isCompleted 
                      ? "text-emerald-600 font-semibold" 
                      : isActive 
                        ? "text-indigo-600 font-bold translate-x-1" 
                        : "text-slate-400"
                  }`}
                >
                  <span className="shrink-0 text-xs font-bold">
                    {isCompleted ? "✓" : isActive ? "➜" : "▢"}
                  </span>
                  <span className={isActive ? "animate-pulse" : ""}>{step}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="text-center text-[10px] text-slate-400 font-mono uppercase tracking-wider">
          TradeMind AI engine parses columns, matches FIFO orders & builds your neural trading profile.
        </div>
      </div>
    </div>
  );
}
