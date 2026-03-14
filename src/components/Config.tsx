import React, { useState } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { Settings, Globe, Database, Cpu, RefreshCw, ShieldCheck, ScrollText } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Config: React.FC = () => {
  const [activeNode, setActiveNode] = useState("Mempool.space (Testnet)");

  const dbLogs = [
    { time: "03:18:42", op: "READ",  msg: "wallet.db → fetched 42 UTXOs",            ok: true },
    { time: "03:18:41", op: "WRITE", msg: "Persisted sync checkpoint block #2,834,110", ok: true },
    { time: "03:18:39", op: "READ",  msg: "Loaded descriptor for NativeLegacy vault",  ok: true },
    { time: "03:18:38", op: "WRITE", msg: "Flushed 3 new txids to transaction log",    ok: true },
    { time: "03:18:35", op: "INDEX", msg: "Re-indexed 5 confirmed outputs",            ok: true },
    { time: "03:18:32", op: "OPEN",  msg: "wallet.db opened — 1.2 MB on disk",        ok: true },
    { time: "03:16:14", op: "WIPE",  msg: "Previous database wiped for fresh start",   ok: false },
  ];

  const nodes = [
    { name: "Mempool.space (Testnet)", url: "https://mempool.space/testnet/api", latency: "42ms" },
    { name: "Blockstream.info", url: "https://blockstream.info/testnet/api", latency: "65ms" },
    { name: "Local Host (Electrs)", url: "http://127.0.0.1:30002", latency: "1ms" },
  ];

  const handleReset = async () => {
    const confirmed = confirm("DANGER: This will permanently wipe all local wallet data, mnemonics, and transaction history. Continue?");
    if (!confirmed) return;
    
    try {
      await invoke("reset_wallet");
      window.location.reload();
    } catch (e) {
      console.error("Reset failed:", e);
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-1000 pb-20 -mt-8">
      <div className="flex flex-col items-center text-center max-w-2xl mx-auto mb-16">
        <div className="w-16 h-16 bg-bitcoin-orange/10 rounded-[2rem] border border-bitcoin-orange/20 flex items-center justify-center mb-6 shadow-2xl shadow-bitcoin-orange/10">
           <Settings className="w-8 h-8 text-bitcoin-orange" />
        </div>
        <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white mb-3">Kernel Configuration</h2>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs leading-relaxed">
          Fine-tune the BDK atomic engine and network connectivity parameters.
        </p>
      </div>

      <div className="space-y-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-10">
             {/* Node Infrastructure */}
             <div className="glass-card p-8 bg-slate-900/40 border-white/[0.08]">
                <div className="flex items-center justify-between mb-8">
                   <div className="flex items-center gap-5">
                      <div className="w-2 h-10 bg-bitcoin-orange/40 rounded-full"></div>
                      <h3 className="font-black italic text-xl tracking-tight uppercase text-white">Pipeline Nodes</h3>
                   </div>
                   <button className="flex items-center gap-3 px-4 py-2 bg-slate-800/50 rounded-xl border border-white/10 text-[9px] font-black uppercase tracking-widest text-slate-300 hover:text-white transition-all">
                      <RefreshCw className="w-3.5 h-3.5" />
                      Probe Latency
                   </button>
                </div>

                <div className="space-y-4">
                   {nodes.map((node) => (
                     <div 
                      key={node.name}
                      onClick={() => setActiveNode(node.name)}
                      className={cn(
                        "p-5 rounded-2xl border transition-all duration-500 cursor-pointer flex items-center justify-between group",
                        activeNode === node.name 
                        ? "bg-bitcoin-orange/10 border-bitcoin-orange/40 shadow-lg shadow-bitcoin-orange/5" 
                        : "bg-slate-950/40 border-white/5 hover:border-white/10"
                      )}
                     >
                       <div className="flex items-center gap-5">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                            activeNode === node.name ? "bg-bitcoin-orange text-white" : "bg-slate-800/50 text-slate-500"
                          )}>
                             <Globe className="w-5 h-5" />
                          </div>
                          <div>
                             <p className={cn(
                               "text-xs font-black uppercase tracking-tight",
                               activeNode === node.name ? "text-white" : "text-slate-400"
                             )}>{node.name}</p>
                             <p className="text-[9px] font-mono text-slate-600 mt-1">{node.url}</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-4">
                          <span className="text-[10px] font-mono font-bold text-slate-500">{node.latency}</span>
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            activeNode === node.name ? "bg-bitcoin-orange animate-pulse" : "bg-slate-800"
                          )}></div>
                       </div>
                     </div>
                   ))}
                </div>
             </div>

              {/* Network Policy */}
              <div className="glass-card p-8 bg-slate-900/40 border-white/[0.08]">
                 <div className="flex items-center gap-5 mb-8">
                    <div className="w-2 h-10 bg-indigo-500/40 rounded-full"></div>
                    <h3 className="font-black italic text-xl tracking-tight uppercase text-white">Chain Environment</h3>
                 </div>
                 <div className="py-8 px-10 bg-indigo-500/5 border border-indigo-500/20 rounded-3xl flex flex-col items-center justify-center text-center">
                    <div className="w-10 h-10 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-5 border border-indigo-500/30">
                       <ShieldCheck className="w-5 h-5 text-indigo-400" />
                    </div>
                    <h4 className="text-lg font-black italic text-white uppercase tracking-tighter mb-2">Protocol: Testnet only</h4>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                       Environment Locked. Mainnet operations are disabled for your safety in this developer build.
                    </p>
                 </div>
              </div>
          </div>

          <div className="space-y-10">
             <div className="glass-card p-8 bg-slate-900/40 border-white/[0.08]">
                <div className="flex items-center gap-4 mb-8">
                   <Database className="w-5 h-5 text-slate-500" />
                   <h4 className="font-black italic uppercase tracking-widest text-slate-500 text-xs">Storage Engine</h4>
                </div>
                <div className="space-y-6">
                   <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider">
                      <span className="text-slate-600">Database Size</span>
                      <span className="text-white">1.2 MB</span>
                   </div>
                   <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider">
                      <span className="text-slate-600">Indexed UTXOs</span>
                      <span className="text-white">42</span>
                   </div>
                   <button 
                    onClick={handleReset}
                    className="w-full py-4 bg-red-500/5 border border-red-500/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500/10 transition-all"
                   >
                      Wipe System & Reset
                   </button>
                 </div>
              </div>

              <div className="glass-card p-8 bg-slate-900/40 border-white/[0.08]">
                 <div className="flex items-center gap-4 mb-4">
                    <Cpu className="w-5 h-5 text-slate-500" />
                    <h4 className="font-black italic uppercase tracking-widest text-slate-500 text-xs">Kernel Status</h4>
                </div>
                <div className="flex items-baseline gap-2 mb-6">
                   <span className="text-3xl font-black italic text-white font-inter">v1.2.0</span>
                   <span className="text-[10px] font-black text-bitcoin-orange uppercase tracking-widest">Stable</span>
                </div>
                <p className="text-slate-500 text-[9px] font-bold leading-relaxed uppercase tracking-widest border-t border-white/5 pt-4">
                   Running on Rust-Core optimized for ARM64/Mac architectures.
                </p>
             </div>
          </div>
        </div>
        
        {/* 📋 DB Event Log */}
        <div className="glass-card p-8 bg-slate-900/40 border-white/[0.08] w-full">
           <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <ScrollText className="w-5 h-5 text-indigo-400" />
                <h4 className="font-black italic uppercase tracking-widest text-slate-500 text-xs">📋 DB Event Log</h4>
              </div>
              <span className="text-[8px] font-black uppercase tracking-widest text-slate-700 px-2 py-1 bg-white/5 rounded-lg">
                {dbLogs.length} entries
              </span>
           </div>
           <div className="space-y-3 mt-4">
             {dbLogs.map((entry, i) => (
               <div key={i} className="flex items-center gap-4 py-3 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] px-4 rounded-xl transition-colors">
                 <span className="text-[10px] font-mono text-slate-500 flex-shrink-0 w-20">{entry.time}</span>
                 <span className={cn(
                   "text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-md flex-shrink-0 w-16 text-center",
                   entry.op === 'WIPE'  ? "bg-red-500/10 text-red-400" :
                   entry.op === 'WRITE' ? "bg-bitcoin-orange/10 text-bitcoin-orange" :
                   entry.op === 'INDEX' ? "bg-indigo-500/10 text-indigo-400" :
                   entry.op === 'OPEN'  ? "bg-green-500/10 text-green-400" :
                   "bg-slate-800 text-slate-500"
                 )}>
                   {entry.op}
                 </span>
                 <span className="text-[10px] font-mono text-slate-300 w-full truncate">{entry.msg}</span>
                 <span className="ml-auto flex-shrink-0">{entry.ok ? "✅" : "⚠️"}</span>
               </div>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
};
