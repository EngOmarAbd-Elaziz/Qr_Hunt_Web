<div align="center">
  <h1>🎯 QR HUNT</h1>
  <p><strong>A Physical + Digital Scavenger Hunt Game</strong></p>

  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E" alt="Vite" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
</div>

<br />

> ⚠️ **Note to Developer:** Replace the placeholder images below with actual screenshots of your running application! Save your screenshots in a new folder called `docs/assets/` and update the paths.

## 🌟 Overview

**QR Hunt** is a modern, mobile-first web application designed for live events with 250-300 players. Players explore a physical venue, scan hidden QR codes, and collect "fragments" (letters). They then use a beautiful drag-and-drop interface on their phones to assemble these letters into hidden words to win the game.

### ✨ Key Features
- **Mobile-First Glassmorphism Design:** A stunning dark-mode UI with fluid animations.
- **Drag & Drop Gameplay:** Seamless touch-friendly letter arrangement using `@dnd-kit/core`.
- **Atomic Transactions:** Zero race conditions. If two players scan the same QR code at the exact same millisecond, Postgres Row Level Locks ensure only one player gets it.
- **Global Realtime Lockouts:** Built on Supabase Realtime — when a word is solved by someone, it instantly locks out for everyone else globally.
- **Automated QR Generation:** A Node.js CLI script that generates cryptographically secure tokens and beautiful printable SVG QR cards.

---

## 📸 Screenshots

<div align="center">
  <table>
    <tr>
      <td align="center"><b>Game Dashboard</b></td>
      <td align="center"><b>Successful Scan</b></td>
    </tr>
    <tr>
      <!-- REPLACE THESE IMAGES -->
      <td><img src="./docs/assets/dashboard.png" width="300" alt="Dashboard Screenshot Placeholder" /></td>
      <td><img src="./docs/assets/scan-success.png" width="300" alt="Scan Screenshot Placeholder" /></td>
    </tr>
    <tr>
      <td align="center"><b>Admin Live View</b></td>
      <td align="center"><b>Winner Screen</b></td>
    </tr>
    <tr>
      <!-- REPLACE THESE IMAGES -->
      <td><img src="./docs/assets/admin.png" width="300" alt="Admin Screenshot Placeholder" /></td>
      <td><img src="./docs/assets/winner.png" width="300" alt="Winner Screenshot Placeholder" /></td>
    </tr>
  </table>
</div>

---

## 🚀 Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/yourusername/Qr_Hunt_Web.git
cd Qr_Hunt_Web
npm install
```

### 2. Generate QR Assets
Generate the 96 physical QR codes and the database seed script:
```bash
npm run generate-qrs
```
*(Images will be saved to `/qr-assets`)*

### 3. Setup Supabase
1. Create a project at [Supabase](https://supabase.com).
2. Run the SQL scripts in the `/supabase` folder in the SQL Editor in this order:
   - `01_schema.sql`
   - `02_rls.sql`
   - `03_rpc.sql`
   - `04_seed.sql` (generated in Step 2)
   - `05_auth_rpc.sql`
   - `06_fix_submit_word.sql`
   - `07_fix_claim_fragment.sql`
   - `08_words_view.sql`
   - `09_performance_and_audit.sql`

### 4. Run Locally
Copy `.env.example` to `.env` and add your keys:
```bash
npm run dev
```

---

## 📖 Documentation
Detailed documentation for running the live event is available in the `docs/` folder:
- [Event Day Checklist](./docs/EVENT_DAY_CHECKLIST.md)
- [Admin Guide](./docs/ADMIN_GUIDE.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)
- [QR Printing Guide](./docs/QR_PRINTING.md)

---

<div align="center">
  <p>Built with ❤️ for community events.</p>
</div>
