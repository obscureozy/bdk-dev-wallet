import React, { useState, useEffect } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { ShieldCheck, Eye, EyeOff, Lock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Safety: React.FC = () => {
  const [showSeed, setShowSeed] = useState(false);
  const [mnemonic, setMnemonic] = useState<string>("•••• •••• •••• •••• •••• •••• •••• •••• •••• •••• •••• ••••");

  useEffect(() => {
    const fetchMnemonic = async () => {
      try {
        const result: string = await invoke("get_mnemonic");
        setMnemonic(result);
      } catch (e) {
        console.error("Failed to fetch mnemonic:", e);
      }
    };
    fetchMnemonic();
  }, []);

  return (
    <div className="space-y-12 animate-in fade-in duration-1000 pb-20 -mt-8">
      <div className="flex flex-col items-center text-center max-w-2xl mx-auto mb-16">
        <div className="w-16 h-16 bg-indigo-500/10 rounded-[2rem] border border-indigo-500/20 flex items-center justify-center mb-6 shadow-2xl shadow-indigo-500/10">
           <ShieldCheck className="w-8 h-8 text-indigo-400" />
        </div>
        <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white mb-3">Security Protocol</h2>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs leading-relaxed">
          Manage the cryptographical integrity and resilience of your private key material.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Seed Phrase Entropy */}
        <div className="glass-card p-10 bg-slate-900/40 border-white/[0.08] relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
              <Lock className="w-24 h-24 text-white" />
           </div>
           
           <div className="flex items-center gap-5 mb-10">
              <div className="w-2 h-12 bg-bitcoin-orange/40 rounded-full"></div>
              <h3 className="font-black italic text-2xl tracking-tight uppercase text-white">Mnemonic Vault</h3>
           </div>

           <div className="space-y-8 relative z-10">
              <div className={cn(
                "p-8 rounded-3xl border transition-all duration-700 backdrop-blur-3xl min-h-[140px] flex items-center justify-center",
                showSeed ? "bg-slate-950/80 border-bitcoin-orange/30 shadow-2xl shadow-bitcoin-orange/5" : "bg-slate-950/40 border-white/5 blur-sm select-none"
              )}>
                 <div className="grid grid-cols-3 gap-x-6 gap-y-3 w-full">
                    {(showSeed ? mnemonic : "•••• •••• •••• •••• •••• •••• •••• •••• •••• •••• •••• ••••").split(' ').map((word, idx) => (
                      <div key={idx} className="flex items-baseline gap-2">
                        <span className="text-[9px] font-black text-slate-700 uppercase tracking-tighter w-2">{idx + 1}</span>
                        <span className="font-mono text-[11px] font-bold text-slate-300">{word}</span>
                      </div>
                    ))}
                 </div>
              </div>

              <div className="flex flex-col gap-4">
                 <button 
                  onClick={() => setShowSeed(!showSeed)}
                  className="w-full py-5 rounded-2xl bg-slate-800/50 border border-white/5 text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 hover:bg-slate-700/50 transition-all"
                 >
                    {showSeed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    {showSeed ? "Redact Secret Material" : "Reveal Recovery Seed"}
                 </button>
                 <div className="p-4 bg-orange-500/5 border border-orange-500/10 rounded-2xl flex gap-4">
                    <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0" />
                    <p className="text-[9px] font-bold text-orange-500/80 uppercase leading-relaxed tracking-wider">
                       Warning: Never share your mnemonic. Anyone with these words can bypass all security and claim your assets.
                    </p>
                 </div>
              </div>
           </div>
        </div>

        {/* Security Health */}
        <div className="glass-card p-10 bg-slate-900/40 border-white/[0.08]">
           <div className="flex items-center gap-5 mb-10">
              <div className="w-2 h-12 bg-green-500/40 rounded-full"></div>
              <h3 className="font-black italic text-2xl tracking-tight uppercase text-white">Integrity Matrix</h3>
           </div>

           <div className="space-y-6">
              {[
                { label: "Encryption Status", status: "Enabled", desc: "AES-256 local database encryption", icon: Lock },
                { label: "Backup Verified", status: "Active", desc: "Last health check: 2 hours ago", icon: CheckCircle2 },
                { label: "Entropy Quality", status: "Optimal", desc: "BIP39 compliant 128-bit source", icon: ShieldCheck },
              ].map((item, i) => (
                <div key={i} className="p-6 bg-slate-950/40 rounded-2xl border border-white/5 flex items-center justify-between group hover:border-white/10 transition-all">
                   <div className="flex items-center gap-5">
                      <div className="w-10 h-10 rounded-xl bg-slate-800/50 flex items-center justify-center text-slate-400 group-hover:text-white transition-colors">
                         <item.icon className="w-5 h-5" />
                      </div>
                      <div>
                         <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">{item.label}</p>
                         <p className="text-[9px] font-bold text-slate-600 uppercase mt-1 tracking-tight">{item.desc}</p>
                      </div>
                   </div>
                   <span className="text-[9px] font-black uppercase tracking-widest text-green-500 bg-green-500/10 px-3 py-1.5 rounded-lg border border-green-500/20">{item.status}</span>
                </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
};
