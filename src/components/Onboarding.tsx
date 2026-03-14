import React, { useState, useRef } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { Copy, RefreshCw, ArrowRight, ShieldCheck, Zap, Key, X } from 'lucide-react';

interface OnboardingProps {
  onComplete: (mnemonic: string) => void;
}

type Mode = 'select' | 'new' | 'import12' | 'import24';

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [mode, setMode] = useState<Mode>('select');
  const [loading, setLoading] = useState(false);
  const [words, setWords] = useState<string[]>(Array(24).fill(''));
  const [generatedMnemonic, setGeneratedMnemonic] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const wordCount = mode === 'import12' ? 12 : 24;

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const result: string = await invoke("generate_mnemonic");
      setGeneratedMnemonic(result);
      setMode('new');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleWordChange = (index: number, value: string) => {
    // Handle paste of full mnemonic into any box
    const trimmed = value.trim();
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length > 1) {
      // It's a paste — distribute words
      const newWords = [...words];
      parts.forEach((word, i) => {
        if (index + i < wordCount) newWords[index + i] = word.toLowerCase();
      });
      setWords(newWords);
      // Focus the next available box
      const nextIdx = Math.min(index + parts.length, wordCount - 1);
      inputRefs.current[nextIdx]?.focus();
      return;
    }
    const newWords = [...words];
    newWords[index] = value.toLowerCase().replace(/[^a-z]/g, '');
    setWords(newWords);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      inputRefs.current[Math.min(index + 1, wordCount - 1)]?.focus();
    }
    if (e.key === 'Backspace' && words[index] === '' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const filledCount = words.slice(0, wordCount).filter(w => w.length > 0).length;
  const isReady = filledCount === wordCount;
  const joinedMnemonic = words.slice(0, wordCount).join(' ').trim();

  const copyGenerated = () => {
    navigator.clipboard.writeText(generatedMnemonic);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => {
    setMode('select');
    setWords(Array(24).fill(''));
    setGeneratedMnemonic('');
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col items-center justify-center min-h-[60vh] animate-fade-in-up">

      {/* Mode: Select */}
      {mode === 'select' && (
        <>
          <div className="text-center mb-14 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-bitcoin-orange/10 blur-[100px] rounded-full -z-10"></div>
            <div className="inline-flex p-5 bg-gradient-to-br from-bitcoin-orange/20 to-orange-500/10 rounded-[2.5rem] mb-8 shadow-2xl shadow-bitcoin-orange/10 border border-bitcoin-orange/20">
              <ShieldCheck className="w-12 h-12 text-bitcoin-orange" />
            </div>
            <h2 className="text-4xl font-black tracking-tighter italic mb-4 text-gradient uppercase">
              🔐 Secure Access
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto font-bold text-lg leading-relaxed">
              Initialize your BDK testnet environment. Generate a fresh seed phrase or restore an existing wallet. 🚀
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl">
            {/* New Wallet */}
            <div className="glass-card p-10 group flex flex-col h-full bg-slate-900/40 hover:bg-slate-900/60 transition-all duration-500 cursor-pointer" onClick={handleGenerate}>
              <div className="p-5 bg-bitcoin-orange/10 rounded-3xl w-fit mb-8 group-hover:bg-bitcoin-orange/20 transition-all duration-300 border border-bitcoin-orange/10">
                <Zap className="w-8 h-8 text-bitcoin-orange" />
              </div>
              <h3 className="text-2xl font-black italic uppercase tracking-tight mb-3 text-white">⚡ New Wallet</h3>
              <p className="text-slate-500 font-bold text-sm mb-10 flex-grow leading-relaxed">
                Generate a secure 12-word seed phrase. Your master key to the Bitcoin testnet.
              </p>
              <button
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-3 text-sm uppercase tracking-widest font-black"
              >
                {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                {loading ? 'Generating...' : 'Create New Wallet'}
              </button>
            </div>

            {/* Import Wallet */}
            <div className="glass-card p-10 group flex flex-col h-full bg-slate-900/40 hover:bg-slate-900/60 transition-all duration-500">
              <div className="p-5 bg-slate-800 rounded-3xl w-fit mb-8 group-hover:bg-slate-700 transition-all duration-300 border border-white/5">
                <Key className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-2xl font-black italic uppercase tracking-tight mb-3 text-white">🔑 Import Wallet</h3>
              <p className="text-slate-500 font-bold text-sm mb-10 flex-grow leading-relaxed">
                Restore an existing wallet using your 12 or 24-word recovery phrase.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => { setWords(Array(24).fill('')); setMode('import12'); }}
                  className="btn-secondary w-full text-sm uppercase tracking-widest font-black"
                >
                  12-Word Phrase
                </button>
                <button
                  onClick={() => { setWords(Array(24).fill('')); setMode('import24'); }}
                  className="w-full py-3 px-6 bg-white/5 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                >
                  24-Word Phrase
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Mode: Display Generated Mnemonic */}
      {mode === 'new' && generatedMnemonic && (
        <div className="max-w-3xl w-full animate-in zoom-in-95 duration-500">
          <div className="glass-card p-12 bg-slate-900/80">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-bitcoin-orange rounded-full shadow-[0_0_10px_rgba(247,147,26,0.8)]"></div>
                <h3 className="font-black italic uppercase tracking-[0.2em] text-slate-400 text-xs">🗝️ Your Recovery Phrase</h3>
              </div>
              <button
                onClick={copyGenerated}
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-bitcoin-orange transition-colors px-4 py-2 bg-slate-800/50 rounded-xl border border-white/5"
              >
                <Copy className="w-3.5 h-3.5" />
                {copied ? '✅ Copied!' : '📋 Copy'}
              </button>
            </div>

            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl mb-8">
              <p className="text-amber-400 text-xs font-bold text-center">
                ⚠️ Write this down and keep it safe! Never share it with anyone.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-12">
              {generatedMnemonic.split(' ').map((word, i) => (
                <div key={i} className="flex items-center gap-3 p-4 bg-slate-950/60 rounded-2xl border border-white/5 group hover:border-bitcoin-orange/40 transition-all duration-500">
                  <span className="text-[10px] font-black italic text-slate-700 uppercase w-6 flex-shrink-0">{i + 1}</span>
                  <span className="text-white font-mono font-black text-sm tracking-tight">{word}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-4">
              <button
                onClick={() => onComplete(generatedMnemonic)}
                className="btn-primary w-full flex items-center justify-center gap-4 py-6 text-base uppercase italic tracking-[0.2em]"
              >
                🚀 Authenticate Protocol
                <ArrowRight className="w-6 h-6" />
              </button>
              <button
                onClick={reset}
                className="text-slate-600 hover:text-white transition-colors text-[10px] font-black uppercase tracking-[0.3em] text-center"
              >
                ← Back to Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mode: Import 12 or 24 words */}
      {(mode === 'import12' || mode === 'import24') && (
        <div className="max-w-3xl w-full animate-in zoom-in-95 duration-500">
          <div className="glass-card p-10 bg-slate-900/80">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <Key className="w-5 h-5 text-bitcoin-orange" />
                <h3 className="font-black italic uppercase tracking-[0.2em] text-slate-400 text-xs">
                  🔑 Enter Your {wordCount}-Word Phrase
                </h3>
              </div>
              <button onClick={reset} className="p-2 rounded-xl text-slate-600 hover:text-white hover:bg-white/5 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Progress indicator */}
            <div className="flex items-center justify-between mb-6">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                {filledCount}/{wordCount} words entered
              </span>
              <div className="flex gap-1">
                {Array.from({ length: wordCount }, (_, i) => (
                  <div
                    key={i}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      words[i] ? 'bg-bitcoin-orange' : 'bg-white/10'
                    }`}
                    style={{ width: wordCount === 12 ? '20px' : '10px' }}
                  />
                ))}
              </div>
            </div>

            {/* Word inputs grid */}
            <div className={`grid gap-2 mb-8 ${wordCount === 12 ? 'grid-cols-3' : 'grid-cols-4'}`}>
              {Array.from({ length: wordCount }, (_, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2.5 focus-within:border-bitcoin-orange/50 transition-all group">
                  <span className="text-[9px] font-black text-slate-700 w-4 flex-shrink-0">{i + 1}</span>
                  <input
                    ref={el => { inputRefs.current[i] = el; }}
                    type="text"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    value={words[i]}
                    onChange={e => handleWordChange(i, e.target.value)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    className="bg-transparent text-white font-mono text-xs flex-1 outline-none placeholder:text-slate-700 min-w-0"
                    placeholder="word"
                  />
                  {words[i] && (
                    <div className="w-1.5 h-1.5 bg-bitcoin-orange rounded-full flex-shrink-0 opacity-70" />
                  )}
                </div>
              ))}
            </div>

            <div className="p-3 bg-slate-950/40 rounded-xl border border-white/5 mb-6">
              <p className="text-[10px] text-slate-600 font-bold text-center">
                💡 Tip: You can paste your full phrase into any box — the words will distribute automatically
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <button
                onClick={() => onComplete(joinedMnemonic)}
                disabled={!isReady}
                className="btn-primary w-full flex items-center justify-center gap-4 py-6 text-base uppercase italic tracking-[0.2em] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isReady ? '✅' : `⌛ ${filledCount}/${wordCount}`} Validate & Import
                <ArrowRight className="w-6 h-6" />
              </button>
              <button
                onClick={reset}
                className="text-slate-600 hover:text-white transition-colors text-[10px] font-black uppercase tracking-[0.3em] text-center"
              >
                ← Return to Selection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
