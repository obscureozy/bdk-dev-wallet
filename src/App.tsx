import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Onboarding } from "./components/Onboarding";
import { Dashboard } from "./components/Dashboard";
import { Safety } from "./components/Safety";
import { Config } from "./components/Config";
import { RefreshCw, LayoutDashboard, Settings, ShieldCheck, HardDrive } from "lucide-react";
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function App() {
  const [walletInitialized, setWalletInitialized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'platform' | 'safety' | 'config'>('platform');

  const checkWallet = async () => {
    try {
      const result = await invoke("get_wallet_info");
      setWalletInitialized(result !== null);
    } catch (e) {
      setWalletInitialized(false);
    } finally {
      setTimeout(() => setLoading(false), 600);
    }
  };

  const handleOnboardingComplete = async (mnemonic: string) => {
    setLoading(true);
    try {
      // Step 1: Initialize the backend wallet engine
      await invoke("create_wallet", { mnemonic: mnemonic.trim() });
      // Step 2: Signal success to the UI state
      setWalletInitialized(true);
    } catch (e) {
      console.error("Critical Protocol Initialization Failure:", e);
      alert("System Protocol Error: The wallet engine could not be initialized with this mnemonic. Please check the Diagnostic Stream.");
      setWalletInitialized(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkWallet();
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 relative overflow-hidden">
         <div className="absolute inset-0 bg-mesh"></div>
         <div className="relative flex flex-col items-center animate-pulse">
            <div className="w-24 h-24 bg-gradient-to-tr from-bitcoin-orange to-orange-400 rounded-3xl flex items-center justify-center font-black text-6xl text-white shadow-2xl shadow-bitcoin-orange/40 mb-10 transform rotate-3">
              ₿
            </div>
            <div className="flex items-center gap-4 py-3 px-6 bg-slate-900/50 rounded-2xl border border-white/5 backdrop-blur-xl">
              <RefreshCw className="w-4 h-4 text-bitcoin-orange animate-spin" />
              <p className="text-slate-300 font-bold tracking-widest uppercase text-[10px]">Kernel Synchronization</p>
            </div>
         </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-100 flex flex-col relative">
      <div className="bg-mesh"></div>
      <div className="bg-dot-grid fixed inset-0 pointer-events-none opacity-40"></div>

      {/* Enhanced Contrast Navigation */}
      <nav className="fixed top-0 left-0 right-0 h-24 z-50 px-8 flex items-center">
        <div className="max-w-7xl mx-auto w-full h-20 bg-slate-900/60 backdrop-blur-3xl rounded-[2rem] border border-white/5 px-8 flex items-center justify-between shadow-2xl shadow-black/20">
           <div className="flex items-center gap-5 group cursor-default">
              <div className="w-12 h-12 bg-gradient-to-tr from-bitcoin-orange to-orange-400 rounded-2xl flex items-center justify-center font-black text-3xl text-white italic shadow-xl shadow-bitcoin-orange/30 group-hover:scale-105 transition-all duration-500">
                ₿
              </div>
               <div className="flex flex-col">
                 <h1 className="font-black text-xl tracking-tight text-white italic leading-none group-hover:tracking-normal transition-all duration-500">₿ BTC 🤙🚀</h1>
                 <span className="text-[10px] text-bitcoin-orange font-black tracking-[0.3em] uppercase opacity-80 mt-1">🧪 Testnet Dev Wallet</span>
               </div>
           </div>

           {walletInitialized && (
             <div className="hidden lg:flex items-center gap-2 bg-slate-800/30 p-1.5 rounded-2xl border border-white/5 shadow-inner">
                <button                   onClick={() => setActiveView('platform')}
                   className={cn(
                     "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all duration-300",
                     activeView === 'platform' 
                     ? "bg-bitcoin-orange text-white shadow-lg shadow-bitcoin-orange/20" 
                     : "text-slate-400 hover:text-white hover:bg-white/5"
                   )}
                 >
                    <LayoutDashboard className="w-4 h-4" />
                    📊 PLATFORM
                </button>
                <button                   onClick={() => setActiveView('safety')}
                   className={cn(
                     "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all duration-300",
                     activeView === 'safety' 
                     ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" 
                     : "text-slate-400 hover:text-white hover:bg-white/5"
                   )}
                 >
                    <ShieldCheck className="w-4 h-4" />
                    🛡️ SAFETY
                </button>
                <button                   onClick={() => setActiveView('config')}
                   className={cn(
                     "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all duration-300",
                     activeView === 'config' 
                     ? "bg-slate-700 text-white shadow-lg shadow-white/5" 
                     : "text-slate-400 hover:text-white hover:bg-white/5"
                   )}
                 >
                    <Settings className="w-4 h-4" />
                    CONFIG
                </button>
              </div>
           )}

           <div className="flex items-center gap-6">
              <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl">
                <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">🦀 v1.2.0 BDK</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-xl">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">🟢 Testnet</span>
              </div>
           </div>
        </div>
      </nav>

      <main className="flex-grow pt-32 pb-20 relative px-8">
        <div className="max-w-7xl mx-auto h-full">
          {!walletInitialized ? (
            <Onboarding onComplete={handleOnboardingComplete} />
          ) : (
            <>
              {activeView === 'platform' && <Dashboard />}
              {activeView === 'safety' && <Safety />}
              {activeView === 'config' && <Config />}
            </>
          )}
        </div>
      </main>

    </div>
  );
}

export default App;
