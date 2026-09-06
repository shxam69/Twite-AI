# Phase 8C — Trusted Local HTTPS Setup with `mkcert` for Physical Android LAN Testing

To enable physical Android phone camera access for scanning QR codes over the local network (LAN) without untrusted self-signed SSL warnings or camera permission blocks, follow this guide to set up a trusted local Root CA using `mkcert`.

---

## Prerequisites

1. **Chocolatey** (Windows) or **Homebrew** (macOS/Linux)
2. **Android Device** connected to the same Wi-Fi network as your host PC.

---

## Step 1: Install `mkcert` on Host PC

On Windows (PowerShell as Administrator):

```powershell
choco install mkcert
```

Or download the binary directly from [mkcert releases](https://github.com/FiloSottile/mkcert/releases).

---

## Step 2: Install Local Root CA

Run the following command to install the local Root CA into your system trust store:

```bash
mkcert -install
```

This creates a local CA certificate on your computer.

---

## Step 3: Find your PC's LAN IP Address

On Windows PowerShell:

```powershell
ipconfig
```

Look for **IPv4 Address** under your active Wi-Fi or Ethernet adapter (e.g. `192.168.1.105`).

---

## Step 4: Generate SSL Certificates for Localhost & LAN IP

Navigate to your project root or `frontend` directory and generate certificates:

```bash
mkdir -p frontend/certs
cd frontend/certs
mkcert localhost 127.0.0.1 YOUR_LAN_IP
```

Example (for LAN IP `192.168.1.105`):

```bash
mkcert -cert-file cert.pem -key-file key.pem localhost 127.0.0.1 192.168.1.105
```

This generates:
- `frontend/certs/cert.pem`
- `frontend/certs/key.pem`

---

## Step 5: Install Root CA Certificate on Android Phone

1. Find the `rootCA.pem` location on your PC by running:
   ```bash
   mkcert -CAROOT
   ```
2. Copy `rootCA.pem` to your Android phone (via USB, Google Drive, or local file server).
3. On your Android phone:
   - Go to **Settings** > **Security** (or **Security & Privacy**).
   - Tap **More security settings** > **Encryption & credentials**.
   - Tap **Install a certificate** > **CA certificate**.
   - Select `rootCA.pem` and confirm installation.

---

## Step 6: Start Application & Access on Mobile Phone

1. **Start Backend Server**:
   ```bash
   cd backend
   npm run dev
   ```
2. **Start Frontend Dev Server**:
   ```bash
   cd frontend
   npm run dev
   ```
   Vite will automatically load `certs/cert.pem` and `certs/key.pem` and display:
   ```
   ➜ Local:   https://localhost:5173/
   ➜ Network: https://192.168.1.105:5173/
   ```

3. **Scan & Test on Android Phone**:
   - Open Chrome on your phone and navigate to `https://192.168.1.105:5173`.
   - Log in as employee.
   - Tap **Scan QR & Check In**.
   - Camera permissions will be granted smoothly without browser security warnings!
