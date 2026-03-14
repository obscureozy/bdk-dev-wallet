import React, { useState, useEffect } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { RefreshCcw, History, ExternalLink, Globe, Copy, Zap, ArrowUpRight, ArrowDownLeft, Activity, Layers, Terminal, X, CheckCircle2, AlertCircle, Key } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { QRCodeSVG } from 'qrcode.react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LogEntry {
  id: string;
  message: string;
  explanation?: string;
  type: 'info' | 'error' | 'success';
  time: string;
}

interface TxInfo {
  txid: string;
  sent: number;
  received: number;
  fee: number;
  confirmation_time: number | null;
}

interface UtxoInfo {
  outpoint: string;
  txid: string;
  vout: number;
  amount: number;
  address: string;
  is_confirmed: boolean;
}

interface FeeEstimates {
  fastest: number;
  half_hour: number;
  hour: number;
  minimum: number;
}

interface ProtocolDetail {
  name: string;
  balance: number;
  address: string;
  type_label: string;
}

interface WalletInfo {
  total_balance: number;
  address: string;
  network: string;
  transactions: TxInfo[];
  utxos: UtxoInfo[];
  protocols: ProtocolDetail[];
}

export const Dashboard: React.FC = () => {
  const [info, setInfo] = useState<WalletInfo | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [copying, setCopying] = useState(false);
  
  // Navigation state
  const [activeTab, setActiveTab] = useState<'core' | 'ledger' | 'advanced'>('core');
  
  // Selected address state
  const [selectedAddress, setSelectedAddress] = useState<string>("");

  // Modal states
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  
  // Send form states
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [feeRate, setFeeRate] = useState("1.0");
  const [sending, setSending] = useState(false);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  // Fee estimation state
  const [fees, setFees] = useState<FeeEstimates | null>(null);
  const [feePriority, setFeePriority] = useState<'fastest' | 'half_hour' | 'hour' | 'minimum'>('half_hour');

  // Log state
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Coin Control state
  const [selectedOutpoints, setSelectedOutpoints] = useState<Set<string>>(new Set());
  const [showDemoUtxos, setShowDemoUtxos] = useState(false);

  // Demo UTXO data — shows coin control working before a real sync
  const DEMO_UTXOS = [
    { outpoint: "a3f2d1b8c4e7f9a2b5c8d1e4f7a2b5c8d1e4f70a2b5c8d1e4f7a2b5c8d1e4f7a2:0", txid: "a3f2d1b8c4e7f9a2b5c8d1e4f7a2b5c8d1e4f70a2b5c8d1e4f7a2b5c8d1e4f7a2", vout: 0, amount: 8000000, address: "tb1q70g3hf5x95dxyya2tuys6ej8qedfwgem6spyx5", is_confirmed: true },
    { outpoint: "b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4:1", txid: "b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4", vout: 1, amount: 1500000, address: "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx", is_confirmed: true },
    { outpoint: "c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8c7a5b4:0", txid: "c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8c7a5b4", vout: 0, amount: 320000, address: "tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7", is_confirmed: false },
  ];
  
  const displayUtxos = showDemoUtxos ? DEMO_UTXOS : (info?.utxos ?? []);
  // Advanced Tools state
  const DEMO_DESCRIPTOR = "wpkh(tpubDEyRdCd697pk4Nkxq47tCpa5jPACYAeghGNwXVWUxYFbLLdP1Ym3NMyzmCcD7dfaqEJsFe6gpCPjqRAkNhrxABMZaLKnsRmKpEgPqFx1fG2/0/*)";

  const [descriptorInput, setDescriptorInput] = useState(DEMO_DESCRIPTOR);
  const [descriptorResult, setDescriptorResult] = useState<any>(null);
  const [descriptorError, setDescriptorError] = useState<string | null>(null);
  const [analyzingDescriptor, setAnalyzingDescriptor] = useState(false);
  
  const [activePsbtStep, setActivePsbtStep] = useState<number | null>(null);

  // Mnemonic Switch state
  const [newMnemonic, setNewMnemonic] = useState("");
  const [switchingMnemonic, setSwitchingMnemonic] = useState(false);

  const toggleUtxo = (outpoint: string) => {
    setSelectedOutpoints(prev => {
      const next = new Set(prev);
      if (next.has(outpoint)) next.delete(outpoint);
      else next.add(outpoint);
      return next;
    });
  };

  const clearUtxoSelection = () => setSelectedOutpoints(new Set());

  const addLog = (message: string, type: 'info' | 'error' | 'success' = 'info', explanation?: string) => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substring(7),
      message,
      explanation,
      type,
      time: new Date().toLocaleTimeString(),
    };
    setLogs(prev => [newLog, ...prev].slice(0, 8)); // Keep a few more logs now that they are in-flow
  };

  const fetchInfo = async () => {
    try {
      const result: WalletInfo | null = await invoke("get_wallet_info");
      setInfo(result);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result: WalletInfo = await invoke("sync_wallet");
      setInfo(result);
    } catch (e) {
      console.error(e);
    } finally {
      setSyncing(false);
    }
  };

  const analyzeDescriptor = async () => {
    if (!descriptorInput) return;
    setAnalyzingDescriptor(true);
    setDescriptorError(null);
    setDescriptorResult(null);
    try {
      const result = await invoke("analyze_descriptor", { descriptor: descriptorInput });
      setDescriptorResult(result);
      addLog("Descriptor analyzed successfully", "success");
    } catch (e) {
      setDescriptorError(String(e));
      addLog("Descriptor analysis failed", "error", String(e));
    } finally {
      setAnalyzingDescriptor(false);
    }
  };


  const copyAddress = (addr?: string) => {
    const textToCopy = addr || selectedAddress || info?.address || "";
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopying(true);
      setTimeout(() => setCopying(false), 2000);
    }
  };

  const handleSend = async () => {
    setSending(true);
    setTxError(null);
    setTxSuccess(null);
    try {
      const amountSats = Math.floor(parseFloat(amount) * 100000000);
      if (isNaN(amountSats) || amountSats <= 0) throw new Error("Invalid amount");
      
      addLog(`Initiating protocol for ${amount} tBTC...`, 'info');
      
      const psbt: string = await invoke("create_transaction", {
        recipient,
        amountSats,
        feeRate: parseFloat(feeRate),
        selectedOutpoints: selectedOutpoints.size > 0 ? Array.from(selectedOutpoints) : null
      });
      
      const txid: string = await invoke("sign_and_broadcast", { psbt });
      setTxSuccess(txid);
      addLog(`Transmission successful: ${txid.substring(0, 8)}...`, 'success');
      setRecipient("");
      setAmount("");
      handleSync(); 
    } catch (e: any) {
      let friendlyError = String(e);
      let explanation = "The network rejected the transaction.";
      
      if (friendlyError.includes("Output below the dust limit")) {
        friendlyError = "Dust Limit Violation";
        explanation = "Amount is too small for the Bitcoin network to process. Try sending at least 546 sats.";
      } else if (friendlyError.includes("InsufficientFunds")) {
        friendlyError = "Empty Vault";
        explanation = "Your balance is too low to cover this amount and the network fees.";
      } else if (friendlyError.includes("address") || friendlyError.includes("Network")) {
        friendlyError = "Invalid Protocol Address";
        explanation = "Ensure usage of a valid Testnet address (Native SegWit, Taproot, Nested or Legacy).";
      }
      
      setTxError(friendlyError);
      addLog(`Protocol Error: ${friendlyError}`, 'error', explanation);
    } finally {
      setSending(false);
    }
  };

  const handleSwitchMnemonic = async () => {
    if (!newMnemonic.trim()) return;
    setSwitchingMnemonic(true);
    addLog("Injecting new protocol mnemonic...", "info");
    try {
      const result: WalletInfo = await invoke("create_wallet", { 
        mnemonic: newMnemonic.trim().toLowerCase()
      });
      setInfo(result);
      setSelectedAddress(result.address); // Force catchup
      setNewMnemonic("");
      setSelectedOutpoints(new Set()); // Clear old selection
      setLogs([]); // Clear old logs for fresh start
      addLog("System Protocol Switched Successfully", "success");
      handleSync();
    } catch (e) {
      addLog("Switch Failure", "error", String(e));
    } finally {
      setSwitchingMnemonic(false);
    }
  };

  const fetchFees = async () => {
    try {
      const estimates: FeeEstimates = await invoke("get_fee_estimates");
      setFees(estimates);
      setFeeRate(estimates[feePriority].toString());
    } catch (e) {
      console.error("Fee fetch failed:", e);
    }
  };

  useEffect(() => {
    fetchInfo();
    fetchFees();
    const infoInterval = setInterval(fetchInfo, 30000);
    const syncInterval = setInterval(handleSync, 120000);
    return () => {
      clearInterval(infoInterval);
      clearInterval(syncInterval);
    };
  }, []);

  useEffect(() => {
    if (fees) {
      setFeeRate(fees[feePriority].toString());
    }
  }, [feePriority, fees]);

  useEffect(() => {
    if (info) {
      setSelectedAddress(info.address);
    }
  }, [info?.address]);

  if (!info) return null;

  return (
    <div className="space-y-12 animate-in fade-in duration-1000 pb-20">
      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-950/60 rounded-2xl border border-white/5 w-fit mx-auto backdrop-blur-xl sticky top-6 z-[50] shadow-2xl">
         {(['core', 'ledger', 'advanced'] as const).map((tab) => (
           <button
             key={tab}
             onClick={() => setActiveTab(tab)}
             className={cn(
               "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 flex items-center gap-3",
               activeTab === tab 
               ? "bg-bitcoin-orange text-white shadow-lg shadow-bitcoin-orange/20" 
               : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
             )}
           >
             {tab === 'core' && <Activity className="w-3.5 h-3.5" />}
             {tab === 'ledger' && <History className="w-3.5 h-3.5" />}
             {tab === 'advanced' && <Layers className="w-3.5 h-3.5" />}
             {tab}
           </button>
         ))}
      </div>

      {activeTab === 'core' && (
        <div className="space-y-12">
          {/* Hero Section */}
          <section className="grid grid-cols-1 xl:grid-cols-3 gap-10">
            <div className="xl:col-span-2 glass-card p-14 bg-slate-900/40 border-white/[0.08] shadow-2xl relative overflow-hidden group min-h-[480px] flex flex-col justify-between">
               <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-bitcoin-orange/5 blur-[120px] rounded-full -mr-48 -mt-48 transition-all duration-700 group-hover:bg-bitcoin-orange/10"></div>
               
               <div className="relative z-10">
                  <div className="flex justify-between items-start mb-16">
                     <div>
                       <div className="flex items-center gap-3 mb-4">
                          <div className="w-1.5 h-6 bg-bitcoin-orange rounded-full"></div>
                          <p className="text-slate-400 font-black italic uppercase tracking-[0.3em] text-[10px]">Testnet Assets Liquid</p>
                       </div>
                       <div className="flex items-end gap-5">
                          <span className="text-8xl font-black italic tracking-tighter text-white drop-shadow-2xl font-inter">
                            {(info.total_balance / 100000000).toLocaleString(undefined, { minimumFractionDigits: 8 })}
                          </span>
                          <span className="text-4xl text-bitcoin-orange font-black italic mb-3 tracking-tighter scale-y-110">tBTC</span>
                       </div>
                       <div className="flex items-center gap-4 mt-8">
                          <div className="px-4 py-2 bg-slate-950/60 rounded-xl border border-white/5 flex items-center gap-3 shadow-inner">
                             <Zap className="w-4 h-4 text-bitcoin-orange" />
                              <span className="text-slate-200 font-mono text-sm font-black tracking-tight">{info.total_balance.toLocaleString()} SATS</span>
                          </div>
                          <div className="px-4 py-2 bg-slate-950/60 rounded-xl border border-white/5 flex items-center gap-3 shadow-inner">
                             <Terminal className="w-4 h-4 text-slate-500" />
                             <span className="text-slate-400 font-mono text-[10px] font-black uppercase tracking-widest leading-none">Status: Verified</span>
                          </div>
                       </div>
                     </div>
                     
                     <button 
                       onClick={handleSync}
                       disabled={syncing}
                       className="flex flex-col items-center gap-3 group/btn"
                     >
                        <div className={cn(
                          "w-16 h-16 rounded-[2rem] bg-slate-800/50 border border-white/10 flex items-center justify-center transition-all duration-500 group-hover/btn:bg-slate-700/50 group-hover/btn:border-bitcoin-orange/40",
                          syncing && "border-bitcoin-orange/60 shadow-lg shadow-bitcoin-orange/20"
                        )}>
                          <RefreshCcw className={cn("w-7 h-7 text-slate-300 transition-all", syncing && "animate-spin text-bitcoin-orange")} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 group-hover/btn:text-white transition-colors tracking-widest">Resync Core</span>
                     </button>
                  </div>
               </div>

               <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <button 
                    onClick={() => setShowSendModal(true)}
                    className="btn-primary flex items-center justify-center gap-4 py-6 text-base font-black uppercase italic tracking-[0.2em]"
                  >
                     <ArrowUpRight className="w-6 h-6" />
                     SEND
                  </button>
                  <button 
                    onClick={() => setShowReceiveModal(true)}
                    className="btn-secondary flex items-center justify-center gap-4 py-6 text-base font-black uppercase italic tracking-[0.2em]"
                  >
                     <ArrowDownLeft className="w-6 h-6" />
                     RECEIVE
                  </button>
               </div>
            </div>

            <div className="flex flex-col gap-8 h-full">
               <div className="glass-card p-10 flex-grow bg-slate-900/40 border-white/[0.08] flex flex-col justify-between">
                  <div>
                     <div className="flex justify-between items-start mb-10">
                        <div className="p-4 bg-bitcoin-orange/10 rounded-3xl border border-bitcoin-orange/20">
                           <Activity className="w-7 h-7 text-bitcoin-orange" />
                        </div>
                        <div className="flex items-center gap-3 px-4 py-2 bg-slate-950/40 rounded-full border border-white/5 shadow-inner">
                           <Globe className="w-3.5 h-3.5 text-green-500" />
                           <span className="text-[10px] font-black uppercase tracking-widest text-slate-200">{info.network}</span>
                        </div>
                     </div>
                     <h3 className="text-2xl font-black italic uppercase tracking-tight mb-4 text-white">System Protocol</h3>
                     <p className="text-slate-500 text-sm font-bold leading-relaxed">Your secure environment is actively converged with the global testnet ledger through high-availability Esplora nodes.</p>
                  </div>

                  <div className="space-y-4 mt-10">
                     {[
                       { label: "Synchronization", value: "Verified", color: "text-green-500" },
                       { label: "Core Version", value: "BDK 1.x", color: "text-slate-400" },
                       { label: "Node Latency", value: "Minimal", color: "text-slate-400" }
                     ].map((stat) => (
                       <div key={stat.label} className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em] border-b border-white/5 pb-3 last:border-0 last:pb-0">
                          <span className="text-slate-600">{stat.label}</span>
                          <span className={stat.color}>{stat.value}</span>
                       </div>
                     ))}
                  </div>
               </div>

               <div className="glass-card p-8 bg-gradient-to-br from-slate-900/40 to-indigo-900/20 border-indigo-500/10">
                  <div className="flex items-center gap-4 mb-4">
                     <Layers className="w-5 h-5 text-indigo-400" />
                     <h4 className="font-black italic uppercase tracking-widest text-indigo-400 text-xs">Descriptor Info</h4>
                  </div>
                  <p className="text-slate-500 text-[10px] font-bold leading-relaxed uppercase tracking-widest">Active Template: <span className="text-slate-300">Native Segwit (BIP84)</span></p>
               </div>
            </div>
          </section>

          {/* Final Row: Diagnostic Stream & Sidebar Controls */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Column 1-8: Stream */}
            <div className="lg:col-span-8 space-y-6">
              <div className="flex items-center gap-4 mb-2">
                 <Terminal className="w-4 h-4 text-slate-500" />
                 <h3 className="font-black italic uppercase tracking-[0.2em] text-slate-500 text-[10px]">Diagnostic Stream</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {logs.length > 0 ? logs.map(log => (
                  <div 
                    key={log.id} 
                    className={cn(
                      "p-5 rounded-2xl border backdrop-blur-xl animate-in fade-in slide-in-from-left-2 duration-300 flex flex-col gap-2 relative overflow-hidden group h-fit",
                      log.type === 'error' ? "bg-red-500/[0.03] border-red-500/10" :
                      log.type === 'success' ? "bg-green-500/[0.03] border-green-500/10" :
                      "bg-slate-900/40 border-white/5"
                    )}
                  >
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            log.type === 'error' ? "bg-red-500" :
                            log.type === 'success' ? "bg-green-500" :
                            "bg-slate-500"
                          )}></div>
                          <span className={cn(
                            "text-[10px] font-black uppercase tracking-widest",
                            log.type === 'error' ? "text-red-400" :
                            log.type === 'success' ? "text-green-400" :
                            "text-slate-400"
                          )}>{log.message}</span>
                       </div>
                       <span className="text-[9px] font-mono text-slate-600">{log.time}</span>
                    </div>
                    {log.explanation && (
                      <p className="text-[10px] font-bold text-slate-500 leading-relaxed uppercase tracking-tight pl-4 border-l border-white/5 mt-1">
                        {log.explanation}
                      </p>
                    )}
                  </div>
                )) : (
                  <div className="md:col-span-2 py-10 border-2 border-dashed border-white/5 rounded-[2rem] flex items-center justify-center">
                     <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-700">Awaiting system events...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Column 9-12: Operational Sidebar */}
            <aside className="lg:col-span-4 space-y-8">
               <div className="glass-card p-10 bg-slate-900/40 border-white/[0.08] group">
                  <div className="flex items-center justify-between mb-8">
                     <h3 className="font-black italic uppercase tracking-[0.2em] text-slate-500 text-[10px]">Active Vault Endpoint</h3>
                     <button 
                      onClick={() => copyAddress()}
                      className="w-10 h-10 rounded-xl bg-slate-800/40 hover:bg-slate-700/40 flex items-center justify-center transition-all group-hover:text-bitcoin-orange border border-white/5"
                     >
                       <Copy className="w-4 h-4" />
                     </button>
                  </div>
                  <div className="bg-slate-950/60 rounded-2xl p-6 break-all font-mono font-bold text-sm text-slate-500 mb-8 border border-white/5 shadow-inner leading-relaxed">
                    {selectedAddress || info.address}
                  </div>
                  <button 
                    onClick={() => copyAddress()}
                    className={cn(
                      "w-full py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] transition-all duration-500 border",
                      copying 
                      ? "bg-green-500/10 text-green-400 border-green-500/30 shadow-lg shadow-green-500/10" 
                      : "bg-slate-800/50 text-slate-500 hover:text-white border-white/5 hover:border-white/10"
                    )}
                  >
                    {copying ? "Endpoint Cloned Successfully" : "Copy Selected Endpoint"}
                  </button>
               </div>

               <div className="glass-card p-10 bg-gradient-to-br from-slate-900/40 to-red-900/10 border-red-500/10">
                   <div className="flex items-center gap-4 mb-8">
                      <Key className="w-5 h-5 text-red-400" />
                      <h4 className="font-black italic uppercase tracking-widest text-red-500 text-[10px]">Hot Swap Protocol</h4>
                   </div>
                   <div className="space-y-4">
                      <textarea 
                        className="w-full bg-slate-950 border border-white/5 rounded-xl p-4 text-xs font-mono text-slate-300 focus:outline-none focus:border-red-500/50 transition-all placeholder:text-slate-800 h-24 resize-none"
                        placeholder="Paste different mnemonic phrase here..."
                        value={newMnemonic}
                        onChange={(e) => setNewMnemonic(e.target.value)}
                      />
                      <button 
                        onClick={handleSwitchMnemonic}
                        disabled={switchingMnemonic || !newMnemonic.trim()}
                        className="w-full py-4 bg-red-500/10 border border-red-500/20 rounded-xl text-[9px] font-black uppercase tracking-[0.3em] text-red-500 hover:bg-red-500/20 transition-all disabled:opacity-50"
                      >
                         {switchingMnemonic ? "RECONFIGURING CORE..." : "INJECT NEW PROTOCOL"}
                      </button>
                   </div>
                </div>

               <div className="glass-card p-10 bg-slate-900/40 border-white/[0.08]">
                  <h3 className="font-black italic uppercase tracking-[0.2em] text-slate-500 text-[10px] mb-8 underline decoration-bitcoin-orange/40 underline-offset-8 text-center">External Pipelines</h3>
                  <div className="space-y-6">
                    {[
                      { label: "Bdk Architecture", url: "https://bitcoindevkit.org" },
                      { label: "Asset Faucets", url: "https://coinfaucet.eu/en/btc-testnet/" },
                      { label: "Mempool Space", url: "https://mempool.space/testnet" },
                    ].map((item, i) => (
                      <a 
                        key={i}
                        href={item.url} 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between text-[10px] font-black text-slate-400 hover:text-bitcoin-orange transition-all group uppercase tracking-widest"
                      >
                         <span className="flex items-center gap-3">
                            <div className="w-1 h-1 bg-slate-700 rounded-full transition-all group-hover:bg-bitcoin-orange group-hover:scale-150"></div>
                            {item.label}
                         </span>
                         <ExternalLink className="w-3.5 h-3.5 opacity-0 -translate-y-1 translate-x-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all" />
                      </a>
                    ))}
                  </div>
               </div>
            </aside>
          </section>
        </div>
      )}

      {activeTab === 'ledger' && (
        <section className="animate-in slide-in-from-bottom-5 duration-700">
           {/* Transaction Registry */}
           <div className="glass-card p-10 bg-slate-900/40 border-white/[0.08] min-h-[500px] relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-slate-700/30 to-transparent"></div>
              <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-5">
                  <div className="w-2 h-12 bg-indigo-500/40 rounded-full"></div>
                  <h3 className="font-black italic text-3xl tracking-tight uppercase text-white">Protocol Ledger</h3>
                </div>
                <div className="flex items-center gap-4">
                   <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">{info.transactions.length} Transactions Found</span>
                   <div className="w-10 h-10 rounded-xl bg-slate-800/50 flex items-center justify-center border border-white/5">
                      <Activity className="w-4 h-4 text-slate-500" />
                   </div>
                </div>
              </div>
              
              {info.transactions.length > 0 ? (
                <div className="space-y-4">
                  {[...info.transactions].sort((a,b) => (b.confirmation_time || 9999999999) - (a.confirmation_time || 9999999999)).map((tx) => {
                    const diff = tx.received - tx.sent;
                    const isPositive = diff >= 0;
                    return (
                      <div key={tx.txid} className="p-6 bg-slate-950/40 rounded-2xl border border-white/5 flex items-center justify-between group hover:border-bitcoin-orange/20 transition-all">
                        <div className="flex items-center gap-6">
                           <div className={cn(
                             "w-12 h-12 rounded-xl flex items-center justify-center",
                             isPositive ? "bg-green-500/10 text-green-500" : "bg-bitcoin-orange/10 text-bitcoin-orange"
                           )}>
                             {isPositive ? <ArrowDownLeft className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
                           </div>
                           <div>
                              <div className="flex items-baseline gap-2">
                                <span className={cn("text-xl font-black italic", isPositive ? "text-green-500" : "text-white")}>
                                  {isPositive ? "+" : ""}{(diff / 100000000).toLocaleString(undefined, { minimumFractionDigits: 8 })}
                                </span>
                                <span className="text-[10px] font-black text-slate-600 uppercase">tBTC</span>
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] font-mono text-slate-500 truncate w-32">{tx.txid}</span>
                                <div className="w-1 h-1 bg-slate-700 rounded-full"></div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                                  {tx.confirmation_time ? new Date(tx.confirmation_time * 1000).toLocaleDateString() : "Pending Verification"}
                                </span>
                              </div>
                           </div>
                        </div>
                        <a 
                          href={`https://mempool.space/testnet/tx/${tx.txid}`} 
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-3 rounded-xl hover:bg-white/5 text-slate-600 hover:text-white transition-all"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="relative flex flex-col items-center justify-center py-24 text-center">
                  <div className="bg-dot-grid absolute inset-0 opacity-10"></div>
                  <div className="p-8 rounded-[2.5rem] bg-slate-950/40 border border-white/5 mb-8 shadow-2xl relative z-10">
                     <History className="w-12 h-12 text-slate-700" />
                  </div>
                  <h4 className="text-slate-300 font-black italic uppercase tracking-[0.4em] text-base mb-3 relative z-10">No records found</h4>
                  <p className="text-slate-600 text-xs font-bold max-w-sm relative z-10 leading-relaxed uppercase tracking-widest">Broadcast a transaction or request assets from a faucet to populate this cryptographical ledger.</p>
                </div>
              )}
           </div>
        </section>
      )}

      {activeTab === 'advanced' && (
        <section className="space-y-12 animate-in slide-in-from-bottom-5 duration-700">
           {/* Phase 3: Coin Control (UTXOs) */}
           <div className="glass-card p-10 bg-slate-900/40 border-white/[0.08]">
              <div className="flex items-center justify-between mb-10">
                 <div className="flex items-center gap-5">
                    <div className="w-2 h-12 bg-indigo-500/40 rounded-full"></div>
                    <h3 className="font-black italic text-3xl tracking-tight uppercase text-white">Coin Control</h3>
                 </div>
                 <div className="flex items-center gap-4">
                    {selectedOutpoints.size > 0 && (
                      <button 
                        onClick={clearUtxoSelection}
                        className="px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-lg text-[8px] font-black uppercase text-red-500 hover:bg-red-500/20 transition-all"
                      >
                        Clear Selection ({selectedOutpoints.size})
                      </button>
                    )}
                    <div className="flex items-center gap-3">
                     {showDemoUtxos && <span className="px-2 py-0.5 bg-bitcoin-orange/20 border border-bitcoin-orange/30 rounded-md text-[8px] font-black uppercase text-bitcoin-orange">DEMO MODE</span>}
                     <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">{displayUtxos.length} Discrete UTXOs</span>
                   </div>
                   <button
                     onClick={() => { setShowDemoUtxos(v => !v); setSelectedOutpoints(new Set()); }}
                     className={cn("px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all",
                       showDemoUtxos 
                       ? "bg-bitcoin-orange/10 border-bitcoin-orange/30 text-bitcoin-orange hover:bg-bitcoin-orange/20"
                       : "bg-white/5 border-white/10 text-slate-500 hover:text-white hover:border-white/20"
                     )}
                   >
                     {showDemoUtxos ? "← Hide Demo" : "▶ Load Demo UTXOs"}
                   </button>
                 </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600 border-b border-white/5">
                      <th className="pb-4 pl-4 w-10"></th>
                      <th className="pb-4">Asset ID (Outpoint)</th>
                      <th className="pb-4">Quantity</th>
                      <th className="pb-4">State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {displayUtxos.map((utxo) => {
                      const isSelected = selectedOutpoints.has(utxo.outpoint);
                      return (
                        <tr 
                          key={utxo.outpoint} 
                          onClick={() => toggleUtxo(utxo.outpoint)}
                          className={cn(
                            "group transition-colors cursor-pointer",
                            isSelected ? "bg-indigo-500/[0.05]" : "hover:bg-white/[0.02]"
                          )}
                        >
                          <td className="py-4 pl-4">
                             <div className={cn(
                               "w-4 h-4 rounded border transition-all flex items-center justify-center",
                               isSelected ? "bg-indigo-500 border-indigo-500" : "border-white/10 group-hover:border-white/20"
                             )}>
                               {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-sm"></div>}
                             </div>
                          </td>
                           <td className="py-4">
                            <div className="flex flex-col gap-1">
                               <span className={cn(
                                 "font-mono text-[10px] transition-colors",
                                 isSelected ? "text-indigo-400" : "text-slate-400"
                               )}>{utxo.txid.substring(0, 24)}...</span>
                               <span className="text-[9px] font-black text-indigo-500/60 uppercase">VOUT: {utxo.vout}</span>
                               <span className="text-[9px] font-mono text-slate-500 truncate w-32" title={utxo.address}>{utxo.address.substring(0, 16)}...</span>
                            </div>
                          </td>
                          <td className="py-4">
                            <div className="flex items-center gap-2">
                               <span className="text-xs font-black text-white">{(utxo.amount / 100000000).toLocaleString(undefined, { minimumFractionDigits: 8 })}</span>
                               <span className="text-[8px] font-black text-slate-600 uppercase">tBTC</span>
                            </div>
                          </td>
                          <td className="py-4">
                             <div className={cn(
                               "px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest inline-flex items-center gap-2",
                               utxo.is_confirmed ? "bg-green-500/10 text-green-500" : "bg-bitcoin-orange/10 text-bitcoin-orange"
                             )}>
                               <div className={cn("w-1 h-1 rounded-full", utxo.is_confirmed ? "bg-green-500" : "bg-bitcoin-orange animate-pulse")}></div>
                               {utxo.is_confirmed ? "Spendable" : "Converging"}
                             </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
           </div>

            {/* Universal Vault Layers */}
            <div className="glass-card p-10 bg-slate-900/40 border-white/[0.08] mb-10">
               <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-5">
                     <div className="w-2 h-12 bg-bitcoin-orange/40 rounded-full"></div>
                     <h3 className="font-black italic text-3xl tracking-tight uppercase text-white">Universal Vault</h3>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">Cross-Script Type Indexing</span>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {info.protocols.map((proto) => (
                    <div 
                      key={proto.name}
                      onClick={() => setSelectedAddress(proto.address)}
                      className={cn(
                        "p-6 rounded-3xl border transition-all duration-500 text-left group relative overflow-hidden cursor-pointer",
                        selectedAddress === proto.address 
                        ? "bg-bitcoin-orange/10 border-bitcoin-orange/40 shadow-lg shadow-bitcoin-orange/5" 
                        : "bg-slate-950/40 border-white/5 hover:border-white/10"
                      )}
                    >
                      <div className="flex items-center justify-between mb-4">
                         <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              proto.balance > 0 ? "bg-green-500 animate-pulse" : "bg-slate-800"
                            )}></div>
                            <span className={cn(
                              "text-[10px] font-black uppercase tracking-widest",
                              selectedAddress === proto.address ? "text-bitcoin-orange" : "text-slate-500"
                            )}>{proto.name}</span>
                         </div>
                         <span className="text-[10px] font-mono font-black text-white bg-white/5 px-2 py-1 rounded-lg">
                            {proto.balance.toLocaleString()} SATS
                         </span>
                      </div>
                      
                      <div className="space-y-2">
                        <p className={cn(
                          "font-mono text-[11px] break-all leading-relaxed bg-black/20 p-3 rounded-xl border border-white/5",
                          selectedAddress === proto.address ? "text-white" : "text-slate-500"
                        )}>{proto.address}</p>
                        <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest pl-1">Derivation Script: {proto.type_label}</p>
                      </div>

                      <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                         <button 
                           onClick={(e) => { e.stopPropagation(); copyAddress(proto.address); }}
                           className="p-2 bg-slate-800 rounded-lg border border-white/10 text-slate-400 hover:text-white"
                         >
                            <Copy className="w-3.5 h-3.5" />
                         </button>
                      </div>
                    </div>
                  ))}
               </div>
            </div>

           <div className="flex flex-col gap-10">
              {/* Descriptor Playground */}
              <div className="glass-card p-10 bg-slate-900/40 border-white/[0.08]">
                 <div className="flex items-center justify-between gap-5 mb-10">
                    <div className="flex items-center gap-5">
                      <div className="w-2 h-12 bg-bitcoin-orange/40 rounded-full"></div>
                      <h3 className="font-black italic text-2xl tracking-tight uppercase text-white">Descriptor Playground</h3>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setDescriptorInput("wpkh(tpubDEyRdCd697pk4Nkxq47tCpa5jPACYAeghGNwXVWUxYFbLLdP1Ym3NMyzmCcD7dfaqEJsFe6gpCPjqRAkNhrxABMZaLKnsRmKpEgPqFx1fG2/0/*)");
                          setDescriptorResult(null);
                          setDescriptorError(null);
                        }}
                        className="px-3 py-1.5 bg-bitcoin-orange/10 border border-bitcoin-orange/20 rounded-lg text-[8px] font-black uppercase text-bitcoin-orange hover:bg-bitcoin-orange/20 transition-all"
                      >TPUB Demo</button>
                      <button
                        onClick={() => {
                          setDescriptorInput("wpkh([73c5da0a/84'/1'/0']tpubDC8msFGeF6pCHBjBaQUefXo2L3hHrLtecPL33yNa38xWU8jDsPqZ6mZGQv2WCqe4oYQ3SWjgDNGv3kBEjv2LcBHCxFsVeAo9GAPQ1TkbNE/0/*)");
                          setDescriptorResult(null);
                          setDescriptorError(null);
                        }}
                        className="px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-[8px] font-black uppercase text-indigo-400 hover:bg-indigo-500/20 transition-all"
                      >BIP84 Demo</button>
                    </div>
                 </div>
                 <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-6">Test and analyze Miniscript descriptors before deployment.</p>
                 
                 <div className="space-y-6">
                    <textarea 
                      className="w-full bg-slate-950 border border-white/10 rounded-2xl p-5 text-white focus:outline-none focus:border-bitcoin-orange/50 transition-all font-mono text-xs placeholder:text-slate-700 min-h-[120px]"
                      placeholder="wpkh([xfp/84'/1'/0']tpub.../0/*)"
                      value={descriptorInput}
                      onChange={(e) => setDescriptorInput(e.target.value)}
                    />
                    <button 
                      onClick={analyzeDescriptor}
                      disabled={analyzingDescriptor || !descriptorInput}
                      className="btn-secondary w-full py-4 text-[10px] font-black uppercase tracking-[0.3em] disabled:opacity-50"
                    >
                      {analyzingDescriptor ? "Analyzing..." : "Analyze Script"}
                    </button>
                    <div className="p-4 bg-slate-950/60 rounded-xl border border-white/5">
                       <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest leading-none">Diagnostic Result: </span>
                       {descriptorResult ? (
                         <div className="mt-2 space-y-1">
                            <p className="text-[10px] font-mono text-green-400">Type: {descriptorResult.is_witness ? "Witness" : "Legacy"}</p>
                            <p className="text-[10px] font-mono text-slate-400 break-all">Policy: {descriptorResult.policy}</p>
                         </div>
                       ) : descriptorError ? (
                         <p className="mt-2 text-[10px] font-mono text-red-400 truncate">{descriptorError}</p>
                       ) : (
                         <span className="text-slate-400">Idle</span>
                       )}
                    </div>
                 </div>
              </div>

              {/* PSBT Educational View */}
              <div className="glass-card p-10 bg-slate-900/40 border-white/[0.08] flex flex-col">
                 <div className="flex justify-between items-start mb-6">
                   <div className="flex items-center gap-5">
                      <div className="w-2 h-12 bg-indigo-500/40 rounded-full"></div>
                      <div>
                        <h3 className="font-black italic text-2xl tracking-tight uppercase text-white">Partially Signed Bitcoin Transaction (PSBT)</h3>
                        <span className="text-indigo-400 text-[9px] font-black uppercase tracking-[0.3em] block mt-1">A Transport Contract</span>
                      </div>
                   </div>
                 </div>
                 <p className="text-slate-500 text-[10px] leading-relaxed font-bold uppercase tracking-widest mb-10 lg:w-3/4">
                   Orchestrate multi-party workflows without exposing private keys. PSBTs follow a strict 6-stage coordination pipeline. Select a phase below to understand its exact responsibility in constructing safe, collaborative transactions.
                 </p>

                 {/* 6-Stage Coordination Pipeline Concept */}
                 <div className="mb-10">
                   <div className="flex justify-between relative mb-6">
                     <div className="absolute top-1/2 left-0 w-full h-px bg-slate-800 -z-10 -translate-y-1/2"></div>
                     {[
                       { name: 'Creator', desc: 'Defines the inputs and outputs (transaction initiation).' },
                       { name: 'Updater', desc: 'Adds metadata such as derivation paths and scripts (context injection).' },
                       { name: 'Signer', desc: 'Appends its partial cryptographic signature without exposing private keys.' },
                       { name: 'Combiner', desc: 'Synchronizes and merges multiple PSBTs signed by different participants.' },
                       { name: 'Finalizer', desc: 'Constructs the final unlocking scripts (witnesses) once all signatures are gathered.' },
                       { name: 'Extractor', desc: 'Strips PSBT metadata to convert the final structure into a standard raw binary transaction for network broadcast.' }
                     ].map((step, idx) => {
                       const isSelected = activePsbtStep === idx;
                       return (
                         <button 
                           key={step.name} 
                           onClick={() => setActivePsbtStep(isSelected ? null : idx)}
                           className="flex flex-col items-center gap-2 group focus:outline-none"
                         >
                           <div className={cn(
                             "w-4 h-4 rounded-full border-2 transition-all duration-300",
                             isSelected 
                              ? "bg-slate-950 border-indigo-400 scale-150 ring-2 ring-indigo-500/50 shadow-[0_0_10px_rgba(129,140,248,0.5)]" 
                              : "bg-slate-950 border-slate-700 group-hover:scale-125 group-hover:border-slate-500"
                           )}></div>
                           <span className={cn(
                             "text-[7px] font-black uppercase tracking-widest transition-colors duration-300",
                             isSelected ? "text-white" : "text-slate-600"
                           )}>{step.name}</span>
                         </button>
                       )
                     })}
                   </div>

                   {/* Step Information Panel */}
                   <div className={cn(
                     "overflow-hidden transition-all duration-300 ease-in-out",
                     activePsbtStep !== null ? "h-auto opacity-100" : "h-0 opacity-0"
                   )}>
                      <div className="p-5 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl flex items-start gap-4">
                        <Activity className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                        <div>
                           <h4 className="text-white text-[10px] font-black uppercase tracking-[0.2em] mb-1">
                             {activePsbtStep !== null && [
                               'Creator', 'Updater', 'Signer', 'Combiner', 'Finalizer', 'Extractor'
                             ][activePsbtStep]} Role
                           </h4>
                           <p className="text-indigo-200/70 text-[10px] leading-relaxed">
                             {activePsbtStep !== null && [
                               'Defines the inputs and outputs (transaction initiation).',
                               'Adds metadata such as derivation paths and scripts (context injection).',
                               'Appends its partial cryptographic signature without exposing private keys.',
                               'Synchronizes and merges multiple PSBTs signed by different participants.',
                               'Constructs the final unlocking scripts (witnesses) once all signatures are gathered.',
                               'Strips PSBT metadata to convert the final structure into a standard raw transaction for network broadcast.'
                             ][activePsbtStep]}
                           </p>
                        </div>
                      </div>
                   </div>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-auto border-t border-white/[0.04] pt-8">
                    <div className="p-4 bg-slate-950/60 rounded-xl border border-white/5 space-y-2">
                       <h4 className="text-white text-[9px] font-black uppercase tracking-[0.1em] mb-2 flex items-center gap-2">🤝 Multisig</h4>
                       <p className="text-[9px] text-slate-500 leading-relaxed font-mono">Guarantees that no signer alters the destination address, as the transaction is already partially sealed.</p>
                    </div>
                    <div className="p-4 bg-slate-950/60 rounded-xl border border-white/5 space-y-2">
                       <h4 className="text-white text-[9px] font-black uppercase tracking-[0.1em] mb-2 flex items-center gap-2">🔄 CoinJoin</h4>
                       <p className="text-[9px] text-slate-500 leading-relaxed font-mono">Signers verify and sign only for their own input. Adding unauthorized outputs automatically invalidates their signature.</p>
                    </div>
                    <div className="p-4 bg-slate-950/60 rounded-xl border border-white/5 space-y-2">
                       <h4 className="text-white text-[9px] font-black uppercase tracking-[0.1em] mb-2 flex items-center gap-2">🛒 Marketplaces</h4>
                       <p className="text-[9px] text-slate-500 leading-relaxed font-mono">Using SIGHASH_SINGLE allows the transaction to be built in independent stages (Seller signs, Buyer pays, Market takes fees).</p>
                    </div>
                    <div className="p-4 bg-slate-950/60 rounded-xl border border-white/5 space-y-2">
                       <h4 className="text-white text-[9px] font-black uppercase tracking-[0.1em] mb-2 flex items-center gap-2">⏳ Script Addresses</h4>
                       <p className="text-[9px] text-slate-500 leading-relaxed font-mono">Inject complex proofs required for unlocking advanced conditions directly without exposing the raw derivation path early.</p>
                    </div>
                 </div>
              </div>
           </div>
        </section>
      )}

      {/* Footer */}
      <div className="flex flex-col items-center gap-4 text-slate-700">
         <div className="w-px h-12 bg-gradient-to-b from-slate-800 to-transparent"></div>
         <p className="text-[10px] font-black uppercase tracking-[0.4em]">BDK-CORE ATOMIC PROTOCOL 0.1.0</p>
      </div>

      {/* Send Modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
           <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowSendModal(false)}></div>
           <div className="glass-card w-full max-w-xl p-12 relative z-10 animate-in zoom-in-95 duration-300">
              <div className="flex justify-between items-center mb-10">
                 <div className="flex items-center gap-4">
                    <ArrowUpRight className="w-8 h-8 text-bitcoin-orange" />
                    <h3 className="text-3xl font-black italic uppercase tracking-tight text-white">SEND</h3>
                 </div>
                 <button onClick={() => setShowSendModal(false)} className="p-3 rounded-2xl hover:bg-white/5 transition-colors">
                    <X className="w-6 h-6" />
                 </button>
              </div>

              {txSuccess ? (
                <div className="text-center py-10 space-y-6">
                  <div className="inline-flex p-5 bg-green-500/10 rounded-full border border-green-500/30 mb-4">
                    <CheckCircle2 className="w-16 h-16 text-green-500" />
                  </div>
                  <h4 className="text-2xl font-black italic uppercase tracking-tight">Transmission Successful</h4>
                  <div className="bg-slate-950/60 p-4 rounded-2xl border border-white/5 text-[10px] font-mono text-slate-500 break-all leading-relaxed">
                    TXID: {txSuccess}
                  </div>
                  <button 
                    onClick={() => {setTxSuccess(null); setShowSendModal(false);}}
                    className="btn-primary w-full py-5 text-sm uppercase tracking-[0.2em]"
                  >
                    Return to Platform
                  </button>
                </div>
              ) : (
                <div className="space-y-8">
                   <div className="space-y-3">
                      <div className="flex justify-between items-center ml-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Destination Address</label>
                        <span className="text-[8px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">All Types Support</span>
                      </div>
                      <input 
                        className="w-full bg-slate-950 border border-white/10 rounded-2xl p-5 text-white focus:outline-none focus:border-bitcoin-orange/50 transition-all font-mono placeholder:text-slate-700"
                        placeholder="tpub, tb1q, tb1p, 2, m, n..."
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                      />
                   </div>
                   <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-2">Volume (tBTC)</label>
                      <input 
                        className="w-full bg-slate-950 border border-white/10 rounded-2xl p-5 text-white focus:outline-none focus:border-bitcoin-orange/50 transition-all font-mono placeholder:text-slate-700"
                        placeholder="0.00000001"
                        type="number"
                        step="any"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                      {selectedOutpoints.size > 0 && (
                        <div className="flex items-center justify-between px-4 py-2 bg-indigo-500/5 border border-indigo-500/10 rounded-xl">
                           <div className="flex items-center gap-2">
                              <Layers className="w-3 h-3 text-indigo-400" />
                              <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Coin Control: {selectedOutpoints.size} Selected</span>
                           </div>
                           <span className="text-[9px] font-mono text-indigo-400">
                              {(info?.utxos.filter(u => selectedOutpoints.has(u.outpoint)).reduce((s, u) => s + u.amount, 0) / 100000000).toLocaleString(undefined, { minimumFractionDigits: 8 })} tBTC
                           </span>
                        </div>
                      )}
                   </div>
                   <div className="space-y-4">
                      <div className="flex justify-between items-center ml-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Priority & Fees</label>
                        {fees && <span className="text-[8px] font-black text-bitcoin-orange uppercase tracking-widest">Live Estimates</span>}
                      </div>
                      
                      <div className="grid grid-cols-4 gap-3">
                         {(['fastest', 'half_hour', 'hour', 'minimum'] as const).map((p) => (
                           <button
                             key={p}
                             onClick={() => setFeePriority(p)}
                             className={cn(
                               "px-2 py-3 rounded-xl border transition-all flex flex-col items-center gap-1",
                               feePriority === p 
                               ? "bg-bitcoin-orange/10 border-bitcoin-orange/40" 
                               : "bg-slate-950 border-white/5 hover:border-white/10"
                             )}
                           >
                              <span className={cn(
                                "text-[8px] font-black uppercase tracking-tighter",
                                feePriority === p ? "text-bitcoin-orange" : "text-slate-500"
                              )}>
                                {p === 'fastest' ? 'High' : p === 'half_hour' ? 'Medium' : p === 'hour' ? 'Low' : 'Min'}
                              </span>
                              <span className="text-[10px] font-mono font-black text-white">
                                {fees ? fees[p] : '...'}
                              </span>
                           </button>
                         ))}
                      </div>

                      <div className="flex items-center gap-3 bg-slate-950 border border-white/10 rounded-2xl p-4">
                        <Terminal className="w-4 h-4 text-slate-700" />
                        <input 
                          className="bg-transparent w-full text-white focus:outline-none font-mono text-xs placeholder:text-slate-700"
                          placeholder="Manual (sats/vB)"
                          type="number"
                          value={feeRate}
                          onChange={(e) => setFeeRate(e.target.value)}
                        />
                        <span className="text-[8px] font-black text-slate-700 uppercase">Manual</span>
                      </div>
                   </div>

                   {txError && (
                     <div className="space-y-4">
                        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex gap-3 text-red-500">
                           <AlertCircle className="w-5 h-5 flex-shrink-0" />
                           <span className="text-xs font-bold leading-relaxed">{txError}</span>
                        </div>
                        {txError.toLowerCase().includes("vault") && (
                           <div className="flex items-center gap-4 p-4 bg-bitcoin-orange/5 border border-bitcoin-orange/10 rounded-2xl">
                              <Zap className="w-4 h-4 text-bitcoin-orange" />
                              <div className="flex-grow">
                                 <p className="text-[9px] font-black uppercase text-bitcoin-orange tracking-widest mb-1 text-left">Depleted Reserves</p>
                                 <div className="flex gap-4">
                                    <a href="https://coinfaucet.eu/en/btc-testnet/" target="_blank" rel="noopener noreferrer" className="text-[8px] font-bold text-slate-500 hover:text-white underline uppercase">CoinFaucet</a>
                                    <a href="https://bitcoinfaucet.uo1.net/" target="_blank" rel="noopener noreferrer" className="text-[8px] font-bold text-slate-500 hover:text-white underline uppercase">UO1</a>
                                    <a href="https://testnet-faucet.mempool.co/" target="_blank" rel="noopener noreferrer" className="text-[8px] font-bold text-slate-500 hover:text-white underline uppercase">Mempool</a>
                                 </div>
                              </div>
                           </div>
                        )}
                     </div>
                   )}

                   <button 
                    onClick={handleSend}
                    disabled={sending || !recipient || !amount}
                    className="btn-primary w-full py-6 flex items-center justify-center gap-4 text-base tracking-[0.2em] disabled:grayscale"
                   >
                     {sending ? <RefreshCcw className="w-6 h-6 animate-spin" /> : <ArrowUpRight className="w-6 h-6" />}
                     Initiate Protocol
                   </button>
                </div>
              ) }
           </div>
        </div>
      )}

      {/* Receive Modal */}
      {showReceiveModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
           <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowReceiveModal(false)}></div>
           <div className="glass-card w-full max-w-xl p-12 relative z-10 animate-in zoom-in-95 duration-300 text-center">
              <div className="flex justify-between items-center mb-10 text-left">
                 <div className="flex items-center gap-4">
                    <ArrowDownLeft className="w-8 h-8 text-bitcoin-orange" />
                    <h3 className="text-3xl font-black italic uppercase tracking-tight text-white">RECEIVE</h3>
                 </div>
                 <button onClick={() => setShowReceiveModal(false)} className="p-3 rounded-2xl hover:bg-white/5 transition-colors">
                    <X className="w-6 h-6" />
                 </button>
              </div>

              <div className="space-y-10">
                 <div className="bg-white p-8 rounded-[2.5rem] w-fit mx-auto shadow-2xl shadow-bitcoin-orange/10 border-8 border-slate-900">
                    <QRCodeSVG value={selectedAddress || info.address} size={200} />
                 </div>

                 <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Active Receive Endpoint</p>
                    <div className="bg-slate-950/60 p-6 rounded-2xl border border-white/5 font-mono font-bold text-sm text-slate-400 break-all leading-relaxed shadow-inner">
                      {selectedAddress || info.address}
                    </div>
                 </div>

                 <button 
                  onClick={() => copyAddress()}
                  className={cn(
                    "w-full py-6 rounded-2xl text-xs font-black uppercase tracking-[0.3em] transition-all duration-500 border",
                    copying 
                    ? "bg-green-500/10 text-green-400 border-green-500/30 shadow-lg shadow-green-500/10" 
                    : "bg-bitcoin-orange text-white border-white/5 hover:bg-bitcoin-orange/80"
                  )}
                 >
                   {copying ? "Cloned to Clipboard" : "Copy Endpoint Address"}
                 </button>

                  <div className="pt-8 border-t border-white/5">
                     <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600 mb-6">Top Up via External Faucets</p>
                     <div className="grid grid-cols-3 gap-3">
                        {[
                           { name: "CoinFaucet", url: "https://coinfaucet.eu/en/btc-testnet/" },
                           { name: "UO1 Faucet", url: "https://bitcoinfaucet.uo1.net/" },
                           { name: "Mempool", url: "https://testnet-faucet.mempool.co/" }
                        ].map((f) => (
                           <a 
                              key={f.name}
                              href={f.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="py-3 px-2 bg-slate-950 border border-white/5 rounded-xl text-[8px] font-black uppercase tracking-widest text-slate-500 hover:text-bitcoin-orange hover:border-bitcoin-orange/30 transition-all flex items-center justify-center gap-2 group"
                           >
                              {f.name}
                              <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                           </a>
                        ))}
                     </div>
                  </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
