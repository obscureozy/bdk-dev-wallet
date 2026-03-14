# ₿ BDK Testnet Dev Wallet

An advanced, developer-focused Bitcoin wallet designed for testing and visualizing core protocol mechanics. Powered by the **Bitcoin Dev Kit (BDK)** in a Rust backend, and featuring a sleek edge-to-edge dark mode interface built with **Tauri**, **React**, **TypeScript**, and **Tailwind CSS**.

---

## ✨ Features

- **Multi-Engine Support:** Native script tracking with seamless descriptor-based configurations.
- **Coin Control:** Interactive UTXO visualizer and selection matrix for precision transaction building.
- **PSBT Pulse:** Learn and visualize Partially Signed Bitcoin Transactions (PSBT) through an interactive 6-stage coordination pipeline.
- **Dynamic Fee Estimation:** Fine-tuned feerate adjustments for optimal transaction modeling.
- **Diagnostics & Config:** Real-time database event logging and kernel system environment configuration.

---

## 🛠 Tech Stack

- **[Tauri](https://tauri.app/) (Rust):** Minimal-footprint desktop execution, local filesystem integration, and secure backend processing.
- **[BDK](https://bitcoindevkit.org/) (Bitcoin Dev Kit):** Complex cryptographic primitives, descriptor processing, and robust transaction syncing.
- **React & TypeScript:** Strict interface typing and dynamic UI logic.
- **Tailwind CSS & Lucide Icons:** Modern, responsive, and aesthetic visual design tailored for developers.

---

## 🚀 Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) and [Rust](https://www.rust-lang.org/) installed on your machine. Follow the [Tauri Prerequisites guide](https://tauri.app/v1/guides/getting-started/prerequisites) if you're setting this up for the first time.

### Installation & Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/obscureozy/bdk-dev-wallet.git
   cd bdk-dev-wallet
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Start the Tauri development server**
   ```bash
   npm run tauri dev
   ```

### Building for Production
To package the app for your local operating system:
```bash
npm run tauri build
```

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
