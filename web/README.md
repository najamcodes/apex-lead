# ApexLead Web Edition (`web/`)

The `web/` directory contains the **Next.js frontend** for running ApexLead in web browsers and cloud deployments.

---

## 🏗️ Directory Structure

```
web/
├── app/                   # Next.js App Router
│   ├── dashboard/         # Dashboard route wrapper
│   ├── leads/             # Leads table route wrapper
│   ├── outreach/          # Outreach & campaign route wrapper
│   ├── pipeline/          # Visual automation pipeline route wrapper
│   ├── review/            # Lead review & approval queue
│   ├── scraper/           # Scraper launcher route wrapper
│   ├── settings/          # Application settings route wrapper
│   ├── tutorial/          # Onboarding guide route wrapper
│   ├── login/             # Authentication page
│   ├── layout.tsx         # Root layout with Geist font & theme provider
│   └── providers.tsx      # App wrapper with WebSocket client initialization
├── middleware.ts          # Route protection and JWT session verification
└── next.config.ts         # Next.js configuration
```

---

## 🚀 Setup & Execution

### 1. Install Dependencies
```bash
cd web
npm install
```

### 2. Configure Environment
Create `web/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_ADAPTER=web
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for Production
```bash
npm run build
npm start
```
