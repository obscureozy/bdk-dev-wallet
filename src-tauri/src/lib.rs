mod wallet;

use bdk_wallet::bitcoin::Network;
use std::sync::Mutex;
use tauri::{Manager, State};
use wallet::{FeeEstimates, WalletInfo, WalletManager};

struct AppState {
    wallet: Mutex<Option<WalletManager>>,
}

#[tauri::command]
fn generate_mnemonic() -> Result<String, String> {
    Ok(wallet::generate_mnemonic())
}

#[tauri::command]
async fn create_wallet(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
    mnemonic: String,
) -> Result<WalletInfo, String> {
    println!(
        "Protocol: Initiating create_wallet for TESTNET ONLY. Mnemonic length: {}",
        mnemonic.split_whitespace().count()
    );

    // 1. Drop the existing wallet connection to unlock files
    {
        let mut wallet_lock = state.wallet.lock().unwrap();
        *wallet_lock = None;
    }

    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    let mnemonic_path = app_dir.join("mnemonic.txt");

    // 2. Clean Slate: Wipe previous databases thoroughly
    if app_dir.exists() {
        println!("Protocol: Wiping existing databases in {app_dir:?}");
        let _ = std::fs::remove_dir_all(&app_dir);
        std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    }

    // 3. Persist mnemonic
    std::fs::write(&mnemonic_path, &mnemonic).map_err(|e| e.to_string())?;

    // 4. Initialize fresh engine (NO sync here - addresses are derived locally)
    let mut manager =
        WalletManager::new(&mnemonic, Network::Testnet, app_dir).map_err(|e| e.to_string())?;

    println!("Protocol: Multi-Engine initialized. Fetching local address info...");

    let info = manager.get_info();
    println!(
        "Protocol: Derived primary endpoint (Native): {}",
        info.address
    );

    // 5. Commit to shared state
    let mut wallet_state = state.wallet.lock().unwrap();
    *wallet_state = Some(manager);

    println!("Protocol: create_wallet completed successfully. Use sync to fetch balances.");
    Ok(info)
}

#[tauri::command]
async fn get_wallet_info(state: State<'_, AppState>) -> Result<Option<WalletInfo>, String> {
    let mut wallet_state = state.wallet.lock().unwrap();

    if let Some(manager) = wallet_state.as_mut() {
        Ok(Some(manager.get_info()))
    } else {
        Ok(None)
    }
}

#[tauri::command]
async fn reset_wallet(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let mut wallet_state = state.wallet.lock().unwrap();
    *wallet_state = None;

    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let db_path = app_dir.join("wallet.db");
    let mnemonic_path = app_dir.join("mnemonic.txt");

    if db_path.exists() {
        let _ = std::fs::remove_file(db_path);
    }
    if mnemonic_path.exists() {
        let _ = std::fs::remove_file(mnemonic_path);
    }

    Ok(())
}

#[tauri::command]
async fn get_mnemonic(app_handle: tauri::AppHandle) -> Result<String, String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let mnemonic_path = app_dir.join("mnemonic.txt");
    if mnemonic_path.exists() {
        std::fs::read_to_string(mnemonic_path).map_err(|e| e.to_string())
    } else {
        Err("Mnemonic not found".into())
    }
}

#[tauri::command]
async fn sync_wallet(state: State<'_, AppState>) -> Result<WalletInfo, String> {
    let mut wallet_state = state.wallet.lock().unwrap();
    if let Some(manager) = wallet_state.as_mut() {
        manager.sync().map_err(|e| e.to_string())?;
        Ok(manager.get_info())
    } else {
        Err("Wallet not initialized".into())
    }
}

#[tauri::command]
async fn create_transaction(
    state: State<'_, AppState>,
    recipient: String,
    amount_sats: u64,
    fee_rate: f32,
    selected_outpoints: Option<Vec<String>>,
) -> Result<String, String> {
    let mut wallet_state = state.wallet.lock().unwrap();
    if let Some(manager) = wallet_state.as_mut() {
        manager
            .create_transaction(recipient, amount_sats, fee_rate, selected_outpoints)
            .map_err(|e| e.to_string())
    } else {
        Err("Wallet not initialized".into())
    }
}

#[tauri::command]
async fn sign_and_broadcast(state: State<'_, AppState>, psbt: String) -> Result<String, String> {
    let mut wallet_state = state.wallet.lock().unwrap();
    if let Some(manager) = wallet_state.as_mut() {
        manager.sign_and_broadcast(psbt).map_err(|e| e.to_string())
    } else {
        Err("Wallet not initialized".into())
    }
}

#[tauri::command]
async fn get_fee_estimates(state: State<'_, AppState>) -> Result<FeeEstimates, String> {
    let wallet_lock = state.wallet.lock().unwrap();
    if let Some(manager) = wallet_lock.as_ref() {
        manager.get_fee_estimates().map_err(|e| e.to_string())
    } else {
        Err("Wallet not initialized".into())
    }
}

#[tauri::command]
async fn inspect_psbt(
    state: State<'_, AppState>,
    psbt: String,
) -> Result<wallet::PsbtInfo, String> {
    let wallet_state = state.wallet.lock().unwrap();
    if let Some(manager) = wallet_state.as_ref() {
        manager.inspect_psbt(psbt).map_err(|e| e.to_string())
    } else {
        Err("Wallet not initialized".into())
    }
}

#[tauri::command]
async fn analyze_descriptor(descriptor: String) -> Result<wallet::DescriptorAnalysis, String> {
    Ok(WalletManager::analyze_descriptor(
        &descriptor,
        Network::Testnet,
    ))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            wallet: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            generate_mnemonic,
            create_wallet,
            get_wallet_info,
            sync_wallet,
            create_transaction,
            sign_and_broadcast,
            get_fee_estimates,
            analyze_descriptor,
            inspect_psbt,
            get_mnemonic,
            reset_wallet
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
