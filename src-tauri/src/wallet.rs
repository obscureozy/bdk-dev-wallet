use anyhow::Result;
use bdk_esplora::{esplora_client, EsploraExt};
use bdk_file_store::Store;
use bdk_wallet::{
    bitcoin::{bip32::Xpriv, secp256k1::Secp256k1, Address, Amount, FeeRate, Network},
    template::{Bip44, Bip49, Bip84, Bip86, DescriptorTemplate},
    KeychainKind, PersistedWallet, Wallet,
};
use bip39::Mnemonic;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::str::FromStr;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WalletInfo {
    pub total_balance: u64,
    pub address: String, // Primary (Native SegWit)
    pub network: String,
    pub transactions: Vec<TxInfo>,
    pub utxos: Vec<UtxoInfo>,
    pub protocols: Vec<ProtocolDetail>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProtocolDetail {
    pub name: String,
    pub balance: u64,
    pub address: String,
    pub type_label: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UtxoInfo {
    pub outpoint: String,
    pub txid: String,
    pub vout: u32,
    pub amount: u64,
    pub address: String,
    pub is_confirmed: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FeeEstimates {
    pub fastest: f32,
    pub half_hour: f32,
    pub hour: f32,
    pub minimum: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TxInfo {
    pub txid: String,
    pub sent: u64,
    pub received: u64,
    pub fee: u64,
    pub confirmation_time: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PsbtInfo {
    pub fee: u64,
    pub fee_rate: f32,
    pub inputs: Vec<PsbtInputInfo>,
    pub outputs: Vec<PsbtOutputInfo>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PsbtInputInfo {
    pub outpoint: String,
    pub amount: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PsbtOutputInfo {
    pub address: String,
    pub amount: u64,
    pub is_change: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DescriptorAnalysis {
    pub is_valid: bool,
    pub address_0: String,
    pub network: String,
    pub is_witness: bool,
    pub policy: String,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ProtocolType {
    Legacy,       // BIP44
    Nested,       // BIP49
    Native,       // BIP84
    Taproot,      // BIP86
    NativeLegacy, // Hybrid: BIP44 Path + Native Segwit
}

pub struct WalletInstance {
    pub wallet: PersistedWallet<Store<bdk_wallet::ChangeSet>>,
    pub db: Store<bdk_wallet::ChangeSet>,
    pub protocol: ProtocolType,
}

pub struct WalletManager {
    pub instances: Vec<WalletInstance>,
    pub network: Network,
}

impl WalletManager {
    pub fn new(mnemonic_str: &str, network: Network, base_path: PathBuf) -> Result<Self> {
        let mnemonic = Mnemonic::from_str(mnemonic_str)
            .map_err(|e| anyhow::anyhow!("Invalid mnemonic: {e}"))?;

        let mut instances = Vec::new();
        let protocols = [
            ProtocolType::Legacy,
            ProtocolType::Nested,
            ProtocolType::Native,
            ProtocolType::Taproot,
            ProtocolType::NativeLegacy,
        ];

        for proto in protocols {
            let sub_dir = match proto {
                ProtocolType::Legacy => "legacy",
                ProtocolType::Nested => "nested",
                ProtocolType::Native => "native",
                ProtocolType::Taproot => "taproot",
                ProtocolType::NativeLegacy => "native_legacy",
            };
            let db_path = base_path.join(format!("{sub_dir}.db"));

            let magic = b"bdk_wallet";
            let mut db = Store::<bdk_wallet::ChangeSet>::open_or_create_new(magic, &db_path)
                .map_err(|e| anyhow::anyhow!("Database error [{sub_dir}]: {e}"))?;

            let wallet = match proto {
                ProtocolType::Legacy => {
                    let (ext_desc, ext_keys, _) =
                        Bip44(mnemonic.clone(), KeychainKind::External).build(network)?;
                    let (int_desc, int_keys, _) =
                        Bip44(mnemonic.clone(), KeychainKind::Internal).build(network)?;
                    match Wallet::load()
                        .descriptor(KeychainKind::External, Some(ext_desc.clone()))
                        .descriptor(KeychainKind::Internal, Some(int_desc.clone()))
                        .load_wallet(&mut db)?
                    {
                        Some(mut w) => {
                            w.set_keymap(KeychainKind::External, ext_keys);
                            w.set_keymap(KeychainKind::Internal, int_keys);
                            w
                        }
                        None => Wallet::create(
                            Bip44(mnemonic.clone(), KeychainKind::External),
                            Bip44(mnemonic.clone(), KeychainKind::Internal),
                        )
                        .network(network)
                        .create_wallet(&mut db)?,
                    }
                }
                ProtocolType::Nested => {
                    let (ext_desc, ext_keys, _) =
                        Bip49(mnemonic.clone(), KeychainKind::External).build(network)?;
                    let (int_desc, int_keys, _) =
                        Bip49(mnemonic.clone(), KeychainKind::Internal).build(network)?;
                    match Wallet::load()
                        .descriptor(KeychainKind::External, Some(ext_desc.clone()))
                        .descriptor(KeychainKind::Internal, Some(int_desc.clone()))
                        .load_wallet(&mut db)?
                    {
                        Some(mut w) => {
                            w.set_keymap(KeychainKind::External, ext_keys);
                            w.set_keymap(KeychainKind::Internal, int_keys);
                            w
                        }
                        None => Wallet::create(
                            Bip49(mnemonic.clone(), KeychainKind::External),
                            Bip49(mnemonic.clone(), KeychainKind::Internal),
                        )
                        .network(network)
                        .create_wallet(&mut db)?,
                    }
                }
                ProtocolType::Native => {
                    let (ext_desc, ext_keys, _) =
                        Bip84(mnemonic.clone(), KeychainKind::External).build(network)?;
                    let (int_desc, int_keys, _) =
                        Bip84(mnemonic.clone(), KeychainKind::Internal).build(network)?;
                    match Wallet::load()
                        .descriptor(KeychainKind::External, Some(ext_desc.clone()))
                        .descriptor(KeychainKind::Internal, Some(int_desc.clone()))
                        .load_wallet(&mut db)?
                    {
                        Some(mut w) => {
                            w.set_keymap(KeychainKind::External, ext_keys);
                            w.set_keymap(KeychainKind::Internal, int_keys);
                            w
                        }
                        None => Wallet::create(
                            Bip84(mnemonic.clone(), KeychainKind::External),
                            Bip84(mnemonic.clone(), KeychainKind::Internal),
                        )
                        .network(network)
                        .create_wallet(&mut db)?,
                    }
                }
                ProtocolType::Taproot => {
                    let (ext_desc, ext_keys, _) =
                        Bip86(mnemonic.clone(), KeychainKind::External).build(network)?;
                    let (int_desc, int_keys, _) =
                        Bip86(mnemonic.clone(), KeychainKind::Internal).build(network)?;
                    match Wallet::load()
                        .descriptor(KeychainKind::External, Some(ext_desc.clone()))
                        .descriptor(KeychainKind::Internal, Some(int_desc.clone()))
                        .load_wallet(&mut db)?
                    {
                        Some(mut w) => {
                            w.set_keymap(KeychainKind::External, ext_keys);
                            w.set_keymap(KeychainKind::Internal, int_keys);
                            w
                        }
                        None => Wallet::create(
                            Bip86(mnemonic.clone(), KeychainKind::External),
                            Bip86(mnemonic.clone(), KeychainKind::Internal),
                        )
                        .network(network)
                        .create_wallet(&mut db)?,
                    }
                }
                ProtocolType::NativeLegacy => {
                    // Hybrid: BIP44 derivation path but encoding pubkeys as P2WPKH (Native Segwit)
                    // Confirmed match: m/44'/1'/0'/0/1 → tb1q70g3hf5x95dxyya2tuys6ej8qedfwgem6spyx5
                    use bdk_wallet::bitcoin::bip32::DerivationPath;
                    let coin_type = if network == Network::Bitcoin { 0 } else { 1 };

                    let seed = mnemonic.to_seed("");
                    let secp = Secp256k1::new();
                    let master_xprv = Xpriv::new_master(network, &seed)
                        .map_err(|e| anyhow::anyhow!("NativeLegacy master key error: {e}"))?;

                    // Derive using Xpriv through ALL hardened steps to account level
                    let account_path = DerivationPath::from_str(&format!("m/44'/{coin_type}'/0'"))
                        .map_err(|e| anyhow::anyhow!("NativeLegacy path error: {e}"))?;
                    let account_xprv = master_xprv
                        .derive_priv(&secp, &account_path)
                        .map_err(|e| anyhow::anyhow!("NativeLegacy derive error: {e}"))?;

                    // Use XPRV (not xpub) in descriptor so this wallet can SIGN transactions
                    // wpkh(xprv/0/*) → derives m/44'/1'/0'/0/index (external, can sign)
                    // wpkh(xprv/1/*) → derives m/44'/1'/0'/1/index (internal/change, can sign)
                    let ext_desc = format!("wpkh({account_xprv}/0/*)");
                    let int_desc = format!("wpkh({account_xprv}/1/*)");

                    match Wallet::load()
                        .descriptor(KeychainKind::External, Some(ext_desc.clone()))
                        .descriptor(KeychainKind::Internal, Some(int_desc.clone()))
                        .load_wallet(&mut db)?
                    {
                        Some(w) => w,
                        None => Wallet::create(ext_desc, int_desc)
                            .network(network)
                            .create_wallet(&mut db)?,
                    }
                }
            };

            instances.push(WalletInstance {
                wallet,
                db,
                protocol: proto,
            });
        }

        Ok(Self { instances, network })
    }

    pub fn get_info(&mut self) -> WalletInfo {
        let mut total_balance = 0;
        let mut all_txs = Vec::new();
        let mut all_utxos = Vec::new();
        let mut protocols = Vec::new();
        let mut primary_address = String::new();

        for inst in &mut self.instances {
            let bal = inst.wallet.balance().total().to_sat();
            total_balance += bal;

            let addr = inst
                .wallet
                .peek_address(KeychainKind::External, 0)
                .address
                .to_string();

            if inst.protocol == ProtocolType::Native {
                primary_address = addr.clone();
            }

            protocols.push(ProtocolDetail {
                name: match inst.protocol {
                    ProtocolType::Legacy => "Legacy BIP44".into(),
                    ProtocolType::Nested => "Nested BIP49".into(),
                    ProtocolType::Native => "Native BIP84".into(),
                    ProtocolType::Taproot => "Taproot BIP86".into(),
                    ProtocolType::NativeLegacy => "Native (Legacy Path)".into(),
                },
                balance: bal,
                address: addr,
                type_label: match inst.protocol {
                    ProtocolType::Legacy => "P2PKH".into(),
                    ProtocolType::Nested => "P2SH-P2WPKH".into(),
                    ProtocolType::Native => "P2WPKH".into(),
                    ProtocolType::Taproot => "P2TR".into(),
                    ProtocolType::NativeLegacy => "BIP44 Hybrid (P2WPKH)".into(),
                },
            });

            // Transactions
            for tx in inst.wallet.transactions() {
                let (sent, received) = inst.wallet.sent_and_received(&tx.tx_node);
                all_txs.push(TxInfo {
                    txid: tx.tx_node.compute_txid().to_string(),
                    sent: sent.to_sat(),
                    received: received.to_sat(),
                    fee: inst
                        .wallet
                        .calculate_fee(&tx.tx_node)
                        .map(|f| f.to_sat())
                        .unwrap_or(0),
                    confirmation_time: match &tx.chain_position {
                        bdk_wallet::chain::ChainPosition::Confirmed { anchor, .. } => {
                            Some(anchor.confirmation_time)
                        }
                        _ => None,
                    },
                });
            }

            // UTXOs
            for utxo in inst.wallet.list_unspent() {
                let addr = bdk_wallet::bitcoin::Address::from_script(&utxo.txout.script_pubkey, self.network)
                    .map(|a| a.to_string())
                    .unwrap_or_else(|_| "Unknown Script".to_string());

                all_utxos.push(UtxoInfo {
                    outpoint: utxo.outpoint.to_string(),
                    txid: utxo.outpoint.txid.to_string(),
                    vout: utxo.outpoint.vout,
                    amount: utxo.txout.value.to_sat(),
                    address: addr,
                    is_confirmed: utxo.chain_position.is_confirmed(),
                });
            }
        }

        // De-duplicate txs (different protocols might see the same tx if it spends/receives to multiple types)
        all_txs.sort_by(|a, b| b.txid.cmp(&a.txid));
        all_txs.dedup_by(|a, b| a.txid == b.txid);

        WalletInfo {
            total_balance,
            address: primary_address,
            network: if self.network == Network::Testnet {
                "testnet".into()
            } else {
                "mainnet".into()
            },
            transactions: all_txs,
            utxos: all_utxos,
            protocols,
        }
    }

    pub fn get_fee_estimates(&self) -> Result<FeeEstimates> {
        let url = if self.network == Network::Testnet {
            "https://mempool.space/testnet/api/v1/fees/recommended"
        } else {
            "https://mempool.space/api/v1/fees/recommended"
        };

        // Simple blocking fetch for dev tool
        let resp = ureq::get(url)
            .call()
            .map_err(|e| anyhow::anyhow!("Fee fetch error: {e}"))?;

        let estimates: serde_json::Value = resp
            .into_json()
            .map_err(|e| anyhow::anyhow!("Fee JSON error: {e}"))?;

        Ok(FeeEstimates {
            fastest: estimates["fastestFee"].as_f64().unwrap_or(1.0) as f32,
            half_hour: estimates["halfHourFee"].as_f64().unwrap_or(1.0) as f32,
            hour: estimates["hourFee"].as_f64().unwrap_or(1.0) as f32,
            minimum: estimates["minimumFee"].as_f64().unwrap_or(1.0) as f32,
        })
    }

    pub fn sync(&mut self) -> Result<()> {
        let url = if self.network == Network::Testnet {
            "https://mempool.space/testnet/api"
        } else {
            "https://mempool.space/api"
        };
        let client = esplora_client::Builder::new(url).build_blocking();

        for inst in &mut self.instances {
            let full_scan_request = inst.wallet.start_full_scan().build();
            let update = client.full_scan(full_scan_request, 20, 5)?;
            inst.wallet.apply_update(update)?;
            inst.wallet.persist(&mut inst.db)?;
        }
        Ok(())
    }

    pub fn create_transaction(
        &mut self,
        recipient: String,
        amount_sats: u64,
        fee_rate: f32,
        selected_outpoints: Option<Vec<String>>,
    ) -> Result<String> {
        self.sync()?;

        let address = Address::from_str(&recipient)?
            .require_network(self.network)
            .map_err(|e| anyhow::anyhow!("Address-Network mismatch: {e}"))?;

        // Find which instance to use
        let inst = if let Some(op_list) = &selected_outpoints {
            if let Some(first_op_str) = op_list.first() {
                let first_op = bdk_wallet::bitcoin::OutPoint::from_str(first_op_str)?;
                self.instances
                    .iter_mut()
                    .find(|i| i.wallet.list_unspent().any(|u| u.outpoint == first_op))
                    .ok_or_else(|| {
                        anyhow::anyhow!(
                            "The selected UTXOs do not belong to any known protocol layer."
                        )
                    })?
            } else {
                self.instances
                    .iter_mut()
                    .max_by_key(|i| i.wallet.balance().total().to_sat())
                    .ok_or_else(|| anyhow::anyhow!("No active protocol layers found."))?
            }
        } else {
            // Pick the one with the highest balance
            self.instances
                .iter_mut()
                .max_by_key(|i| i.wallet.balance().total().to_sat())
                .ok_or_else(|| anyhow::anyhow!("No active protocol layers found."))?
        };

        let mut tx_builder = inst.wallet.build_tx();
        tx_builder
            .add_recipient(address.script_pubkey(), Amount::from_sat(amount_sats))
            .fee_rate(FeeRate::from_sat_per_vb(fee_rate.ceil() as u64).unwrap_or(FeeRate::ZERO));

        if let Some(outpoints) = selected_outpoints {
            let mut selected = Vec::new();
            for op_str in outpoints {
                let op = bdk_wallet::bitcoin::OutPoint::from_str(&op_str)?;
                selected.push(op);
            }
            tx_builder.manually_selected_only();
            tx_builder.add_utxos(&selected)?;
        }

        let psbt = tx_builder.finish()?;
        Ok(psbt.to_string())
    }

    pub fn sign_and_broadcast(&mut self, psbt_str: String) -> Result<String> {
        let mut psbt = bdk_wallet::bitcoin::psbt::Psbt::from_str(&psbt_str)?;
        let sign_options = bdk_wallet::SignOptions::default();

        // Try all wallets to sign
        let mut finalized = false;
        let mut error = None;

        for inst in &mut self.instances {
            match inst.wallet.sign(&mut psbt, sign_options.clone()) {
                Ok(fin) => {
                    if fin {
                        finalized = true;
                        break;
                    }
                }
                Err(e) => {
                    error = Some(e);
                }
            }
        }

        if !finalized {
            return Err(anyhow::anyhow!("Finalization Error: None of the active protocol layers could authorize this transaction. Last error: {error:?}"));
        }

        let tx = psbt.extract_tx()?;
        let txid = tx.compute_txid();

        let url = if self.network == Network::Testnet {
            "https://mempool.space/testnet/api"
        } else {
            "https://mempool.space/api"
        };

        let client = esplora_client::Builder::new(url).build_blocking();
        client.broadcast(&tx)?;

        // Persist all wallets
        for inst in &mut self.instances {
            inst.wallet.persist(&mut inst.db)?;
        }

        Ok(txid.to_string())
    }

    pub fn inspect_psbt(&self, psbt_str: String) -> Result<PsbtInfo> {
        let psbt = bdk_wallet::bitcoin::psbt::Psbt::from_str(&psbt_str)?;

        // Fee calculation might be tricky if we don't have all previous outputs.
        // We'll try to find any instance that can calculate it.
        let mut fee = Amount::ZERO;
        let mut fee_rate = FeeRate::ZERO;

        for inst in &self.instances {
            if let Ok(f) = inst.wallet.calculate_fee(&psbt.unsigned_tx) {
                fee = f;
            }
            if let Ok(fr) = inst.wallet.calculate_fee_rate(&psbt.unsigned_tx) {
                fee_rate = fr;
            }
        }

        let inputs = psbt
            .inputs
            .iter()
            .enumerate()
            .map(|(i, _)| {
                let outpoint = psbt.unsigned_tx.input[i].previous_output;
                let mut amount = 0;
                for inst in &self.instances {
                    if let Some(u) = inst.wallet.list_unspent().find(|u| u.outpoint == outpoint) {
                        amount = u.txout.value.to_sat();
                        break;
                    }
                }
                PsbtInputInfo {
                    outpoint: outpoint.to_string(),
                    amount,
                }
            })
            .collect();

        let outputs = psbt
            .unsigned_tx
            .output
            .iter()
            .map(|output| {
                let address = Address::from_script(&output.script_pubkey, self.network)
                    .map(|a| a.to_string())
                    .unwrap_or_else(|_| "Unknown Script".to_string());

                let mut is_mine = false;
                for inst in &self.instances {
                    if inst.wallet.is_mine(output.script_pubkey.clone()) {
                        is_mine = true;
                        break;
                    }
                }

                PsbtOutputInfo {
                    address,
                    amount: output.value.to_sat(),
                    is_change: is_mine,
                }
            })
            .collect();

        Ok(PsbtInfo {
            fee: fee.to_sat(),
            fee_rate: fee_rate.to_sat_per_vb_ceil() as f32,
            inputs,
            outputs,
        })
    }

    pub fn analyze_descriptor(descriptor: &str, network: Network) -> DescriptorAnalysis {
        let secp = bdk_wallet::bitcoin::secp256k1::Secp256k1::new();

        let res = bdk_wallet::descriptor::IntoWalletDescriptor::into_wallet_descriptor(
            descriptor, &secp, network,
        );

        match res {
            Ok((desc, _keymap)) => {
                let addr = match desc.at_derivation_index(0) {
                    Ok(d) => d
                        .address(network)
                        .map(|a| a.to_string())
                        .unwrap_or_else(|_| "Invalid Address".to_string()),
                    Err(_) => "N/A".to_string(),
                };

                DescriptorAnalysis {
                    is_valid: true,
                    address_0: addr,
                    network: network.to_string(),
                    is_witness: true, // Placeholder or implement proper check
                    policy: format!("{desc:?}"), // Simple string representation for now
                    error: None,
                }
            }
            Err(e) => DescriptorAnalysis {
                is_valid: false,
                address_0: "".to_string(),
                network: network.to_string(),
                is_witness: false,
                policy: "".to_string(),
                error: Some(e.to_string()),
            },
        }
    }
}

pub fn generate_mnemonic() -> String {
    let mut entropy = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut entropy);
    let mnemonic = Mnemonic::from_entropy(&entropy).unwrap();
    mnemonic.to_string()
}
