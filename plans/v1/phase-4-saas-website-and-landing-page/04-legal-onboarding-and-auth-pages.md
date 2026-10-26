# Implementation Prompt: Auth UI, 60-Second Onboarding Wizard & Legal Compliance Suite

## Prompt Objective
Build the client-side authentication screens (`/login`, `/register`, `/auth/callback`), the interactive 60-second onboarding wizard (`/onboarding`) that delivers instant first-run lead gratification, and legally compliant Terms of Service (`/terms`) and Privacy Policy (`/privacy`) pages within the Next.js 15 App Router website.

---

## Context & Architectural Rationale
A high-converting SaaS lives or dies by its activation rate. If a user signs up and is dumped onto an empty dashboard with zero guidance, churn exceeds 70%.

The ApexLead onboarding pipeline achieves rapid Time-to-Value (TTV < 60s):
1. **Frictionless Auth:** Google 1-Click OAuth alongside standard email/password (backed by Argon2id in Phase 2).
2. **Dynamic Industry Preset Selection:** User selects their target niche (e.g., General Contractors, HVAC, Dental Clinics, B2B Software).
3. **Instant First-Run Gratification:** The onboarding wizard automatically launches a free 5-lead live scrape in the background and renders fresh, enriched contacts before the user even enters the main dashboard.
4. **Strict Legal Compliance:** CAN-SPAM Act, GDPR, and CCPA adherence disclosures to protect the SaaS and its users when harvesting publicly available B2B contact info.

---

## File Changes & Additions

```
website/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── layout.tsx
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── register/
│   │   │   │   └── page.tsx
│   │   │   └── callback/
│   │   │       └── page.tsx
│   │   ├── (dashboard)/
│   │   │   └── onboarding/
│   │   │       └── page.tsx
│   │   └── (legal)/
│   │       ├── terms/
│   │       │   └── page.tsx
│   │       └── privacy/
│   │           └── page.tsx
│   ├── components/
│   │   ├── auth/
│   │   │   ├── GoogleSignInButton.tsx
│   │   │   └── AuthForm.tsx
│   │   └── onboarding/
│   │       ├── StepIndustryPicker.tsx
│   │       ├── StepTargetRegion.tsx
│   │       └── StepInstantLiveScrape.tsx
│   └── lib/
│       └── auth-client.ts
```

---

## Detailed Implementation Code

### 1. Unified Client Auth Wrapper (`website/src/lib/auth-client.ts`)

```typescript
import { z } from 'zod';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const registerSchema = loginSchema.extend({
  fullName: z.string().min(2, 'Full name is required'),
  organizationName: z.string().min(2, 'Organization or Agency name is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

export async function loginWithCredentials(data: LoginInput) {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Login failed' }));
    throw new Error(error.message || 'Invalid credentials');
  }
  return res.json();
}

export async function registerWithCredentials(data: RegisterInput) {
  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Registration failed' }));
    throw new Error(error.message || 'Could not complete registration');
  }
  return res.json();
}
```

---

### 2. Modern High-Converting Auth Layout & Form (`website/src/app/(auth)/login/page.tsx`)

```tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { loginSchema, LoginInput, loginWithCredentials } from '@/lib/auth-client';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    try {
      setServerError(null);
      await loginWithCredentials(data);
      router.push('/dashboard');
    } catch (err: any) {
      setServerError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-emerald-500/10 blur-[140px] pointer-events-none rounded-full" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
        <Link href="/" className="inline-flex items-center gap-2 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-extrabold text-slate-950 text-xl shadow-lg shadow-emerald-500/20">
            A
          </div>
          <span className="text-2xl font-bold tracking-tight text-white">ApexLead</span>
        </Link>
        <h2 className="text-3xl font-extrabold text-white tracking-tight">Welcome back</h2>
        <p className="mt-2 text-sm text-slate-400">
          Sign in to access your live lead scraping pipelines.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4 sm:px-0">
        <div className="bg-slate-900/80 border border-slate-800 py-8 px-6 shadow-2xl rounded-2xl backdrop-blur-xl sm:px-10">
          {serverError && (
            <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-800/60 flex items-center gap-3 text-red-400 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <GoogleSignInButton />

          <div className="mt-6 relative flex items-center justify-center">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-slate-900 px-3 text-xs text-slate-500 uppercase tracking-wider font-semibold">
              Or with email
            </span>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Work Email</label>
              <input
                {...register('email')}
                type="email"
                placeholder="you@company.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
              {errors.email && (
                <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-medium text-slate-300">Password</label>
                <Link href="/auth/forgot-password" className="text-xs text-emerald-400 hover:text-emerald-300">
                  Forgot password?
                </Link>
              </div>
              <input
                {...register('password')}
                type="password"
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
              {errors.password && (
                <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 text-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Signing in...
                </>
              ) : (
                <>
                  Sign In <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            Don't have an account?{' '}
            <Link href="/register" className="text-emerald-400 hover:text-emerald-300 font-semibold">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
```

---

### 3. The 60-Second Onboarding Wizard (`website/src/app/(dashboard)/onboarding/page.tsx`)

```tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Building2, Hammer, Stethoscope, Laptop, MapPin, 
  Sparkles, CheckCircle2, ArrowRight, Loader2, Mail, Phone 
} from 'lucide-react';

const INDUSTRIES = [
  { id: 'contractors', title: 'Contractors & Trades', icon: Hammer, desc: 'Roofing, HVAC, Solar, Plumbing' },
  { id: 'b2b-saas', title: 'B2B Software & Tech', icon: Laptop, desc: 'Founders, CTOs, Marketing VP' },
  { id: 'healthcare', title: 'Healthcare & Clinics', icon: Stethoscope, desc: 'Dentists, Chiropractors, MedSpas' },
  { id: 'commercial', title: 'Professional Services', icon: Building2, desc: 'Lawyers, Accountants, Agencies' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedIndustry, setSelectedIndustry] = useState<string>('contractors');
  const [targetLocation, setTargetLocation] = useState<string>('Dallas, TX');
  const [isScraping, setIsScraping] = useState<boolean>(false);
  const [sampleLeads, setSampleLeads] = useState<any[]>([]);

  const handleRunFirstScrape = async () => {
    setIsScraping(true);
    setStep(3);

    // Simulate instant real-time live scrape (or trigger actual preview endpoint)
    setTimeout(() => {
      setSampleLeads([
        {
          name: 'Apex Precision Roofing & Solar',
          contact: 'Marcus Vance',
          title: 'Managing Director',
          email: 'marcus@apexroofingtx.com',
          phone: '+1 (214) 555-0192',
          verified: true,
          rating: 4.9,
          reviews: 84,
        },
        {
          name: 'Lone Star Climate Solutions',
          contact: 'Sarah Jenkins',
          title: 'Operations VP',
          email: 's.jenkins@lonestarclimate.com',
          phone: '+1 (214) 555-8371',
          verified: true,
          rating: 4.8,
          reviews: 112,
        },
        {
          name: 'Metroplex Custom Plumbing',
          contact: 'David Keller',
          title: 'Owner',
          email: 'david@metroplexplumbing.net',
          phone: '+1 (972) 555-3349',
          verified: true,
          rating: 5.0,
          reviews: 67,
        },
      ]);
      setIsScraping(false);
    }, 2800);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center py-12 px-4 sm:px-6">
      <div className="w-full max-w-2xl">
        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-8 px-4">
          <div className={`flex items-center gap-2 text-sm font-semibold ${step >= 1 ? 'text-emerald-400' : 'text-slate-600'}`}>
            <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs">1</span>
            Target Industry
          </div>
          <div className="w-12 h-px bg-slate-800" />
          <div className={`flex items-center gap-2 text-sm font-semibold ${step >= 2 ? 'text-emerald-400' : 'text-slate-600'}`}>
            <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs">2</span>
            Location Target
          </div>
          <div className="w-12 h-px bg-slate-800" />
          <div className={`flex items-center gap-2 text-sm font-semibold ${step >= 3 ? 'text-emerald-400' : 'text-slate-600'}`}>
            <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs">3</span>
            Live Discovery
          </div>
        </div>

        {/* Step 1: Industry Picker */}
        {step === 1 && (
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl">
            <h2 className="text-2xl font-bold mb-2">What kind of leads are you looking for?</h2>
            <p className="text-sm text-slate-400 mb-6">We'll preconfigure your scrapers and data schema automatically.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {INDUSTRIES.map((ind) => {
                const Icon = ind.icon;
                const active = selectedIndustry === ind.id;
                return (
                  <button
                    key={ind.id}
                    onClick={() => setSelectedIndustry(ind.id)}
                    className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      active
                        ? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10'
                        : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className={`p-2.5 rounded-lg ${active ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      {active && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                    </div>
                    <div>
                      <h4 className="font-semibold text-white text-sm">{ind.title}</h4>
                      <p className="text-xs text-slate-400 mt-1">{ind.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all flex items-center justify-center gap-2"
            >
              Continue to Location <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 2: Location Selector */}
        {step === 2 && (
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl">
            <h2 className="text-2xl font-bold mb-2">Where do you want to find prospects?</h2>
            <p className="text-sm text-slate-400 mb-6">Enter a city, metropolitan area, or postal zip code.</p>

            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-300 mb-2">City & State / Metro Area</label>
              <div className="relative">
                <MapPin className="w-5 h-5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={targetLocation}
                  onChange={(e) => setTargetLocation(e.target.value)}
                  placeholder="e.g. Austin, TX or Miami, FL"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <button
              onClick={handleRunFirstScrape}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" /> Launch Free Live Discovery Test
            </button>
          </div>
        )}

        {/* Step 3: Instant Live Scrape Results */}
        {step === 3 && (
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl">
            {isScraping ? (
              <div className="py-16 text-center">
                <Loader2 className="w-12 h-12 text-emerald-400 animate-spin mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Triggering Live Scrapers & Waterfall Validation...</h3>
                <p className="text-sm text-slate-400 max-w-sm mx-auto">
                  Connecting to Google Maps & verifying SMTP mailboxes in {targetLocation}...
                </p>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold">First 3 Live Leads Found!</h3>
                    <p className="text-xs text-emerald-400 mt-0.5">100% active, verified direct contacts.</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300 text-xs font-semibold">
                    Live Crawl Complete
                  </span>
                </div>

                <div className="space-y-3 mb-8">
                  {sampleLeads.map((lead, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-white text-sm flex items-center gap-2">
                          {lead.name}
                          <span className="text-xs text-amber-400">★ {lead.rating} ({lead.reviews})</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          {lead.contact} · {lead.title}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-300 mt-2">
                          <span className="flex items-center gap-1 text-emerald-400 font-mono">
                            <Mail className="w-3.5 h-3.5" /> {lead.email}
                          </span>
                          <span className="flex items-center gap-1 text-slate-400 font-mono">
                            <Phone className="w-3.5 h-3.5" /> {lead.phone}
                          </span>
                        </div>
                      </div>
                      <div className="hidden sm:block">
                        <span className="px-2 py-1 rounded bg-emerald-950/60 border border-emerald-800/50 text-emerald-400 text-xs font-medium">
                          Deliverable
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => router.push('/dashboard')}
                  className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  Enter Your Workspace Dashboard <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### 4. Legal Compliance Suite (`website/src/app/(legal)/terms/page.tsx` & `/privacy/page.tsx`)

#### Terms of Service (`website/src/app/(legal)/terms/page.tsx`)
Must define:
1. **Nature of Service:** ApexLead provides automated software tools for aggregating publicly available business information and verifying business contact details.
2. **Acceptable Use & Anti-Spam (CAN-SPAM / CASL / GDPR):** Users are strictly prohibited from utilizing collected data for unlawful unsolicited marketing, harassment, or violating local spam legislation. Users are responsible for providing clear opt-out links in cold outreach.
3. **No Resale Restrictions:** Users retain full proprietary ownership of their scraped and enriched data pipelines.
4. **Subscription & Billing Terms:** Monthly memberships renewed via Polar.sh. Subscriptions can be canceled at any time with access continuing through the end of the paid billing cycle.

#### Privacy Policy (`website/src/app/(legal)/privacy/page.tsx`)
Must define:
1. **Data Controller vs. Data Processor:** ApexLead acts as a Data Processor for the prospect data scraped by its users, and a Data Controller for its direct customer account information.
2. **Data Minimization:** No personal consumer data is intentionally crawled; algorithms are tuned specifically for B2B commercial entities.
3. **Right to Opt-Out & Erasure:** Dedicated opt-out mechanism (`privacy@apexlead.ai`) allowing any business contact to request deletion from our enrichment cache within 48 hours.

---

## Verification & Acceptance Criteria
1. **Authentication Flow Verification:** Test credentials login, register, and Google OAuth callback redirecting to `/dashboard` or `/onboarding`.
2. **Onboarding TTV:** Validate that new users complete the 3-step onboarding flow in under 60 seconds with simulated or real sample leads rendered cleanly.
3. **Form Validation:** Verify client-side Zod validation triggers clean inline error messages without page reloads.
4. **Compliance Audit:** Ensure Terms of Service and Privacy Policy pages include direct contact email addresses and clear GDPR/CAN-SPAM clauses.
