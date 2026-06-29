import { Card } from '../../components/ui/Card'
import { motion } from 'framer-motion'
import { BookOpen, Key, Link, Shield } from 'lucide-react'

export function Tutorial() {
  return (
    <div className="space-y-6 max-w-4xl font-sans pb-12">
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Welcome to LeadHunter</h1>
        <p className="text-zinc-400">
          Everything you need to know to automate your lead generation and outreach.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-1">
              <BookOpen className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-emerald-100">Basic Workflow</h2>
              <div className="space-y-3 text-zinc-300">
                <p><strong>1. Configure Settings:</strong> Head to the Settings page and input your API keys (like OpenAI, OpenRouter, Google PageSpeed) to enable AI scoring and website analysis.</p>
                <p><strong>2. Add Email Accounts:</strong> On the Settings page, add the Gmail/SMTP accounts you want to use for outreach.</p>
                <p><strong>3. Scrape Leads:</strong> Go to the Scraper page, type in your search query (e.g., "Plumbers in Austin, TX"), and click "Scrape". LeadHunter will use stealth automation to find Google Maps businesses and their websites.</p>
                <p><strong>4. Review & Approve:</strong> Go to the Review page. The AI will have automatically scored the leads based on their website quality and contact info. Click "Approve" for the ones you want to contact.</p>
                <p><strong>5. Outreach Pipeline:</strong> Once approved, the system takes over. Background tasks will draft personalized emails using AI, run email validation, and gradually send emails through your configured accounts on a schedule. You can view all activity on the Dashboard or the Leads tab.</p>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-1">
              <Key className="w-5 h-5 text-blue-400" />
            </div>
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-blue-100">Integrating Services</h2>
              <p className="text-zinc-400 text-sm">LeadHunter relies on a few external APIs to be fully effective. All of these can be configured in the Settings tab inside the app.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                  <h3 className="font-semibold text-zinc-200 mb-2">AI Engine</h3>
                  <p className="text-sm text-zinc-400 mb-2">Drafts personalized emails and scores websites. OpenRouter is highly recommended for cheap access to top models.</p>
                  <ul className="text-sm text-zinc-300 list-disc list-inside space-y-1">
                    <li><strong>OpenRouter:</strong> Use `anthropic/claude-3.5-sonnet`</li>
                    <li><strong>OpenAI:</strong> Use `gpt-4o-mini`</li>
                    <li><strong>Groq:</strong> Use `llama3-70b-8192`</li>
                    <li><strong>Local (LM Studio):</strong> `http://localhost:1234/v1`</li>
                  </ul>
                </div>
                
                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                  <h3 className="font-semibold text-zinc-200 mb-2">Google PageSpeed API</h3>
                  <p className="text-sm text-zinc-400 mb-2">Used to determine if a prospect's website is slow or outdated (a great sales angle!).</p>
                  <ul className="text-sm text-zinc-300 list-disc list-inside space-y-1">
                    <li>Get a free key from Google Cloud Console</li>
                    <li>Enable the "PageSpeed Insights API"</li>
                    <li>Paste the key into Settings</li>
                  </ul>
                </div>

                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 md:col-span-2">
                  <h3 className="font-semibold text-zinc-200 mb-2">2Captcha</h3>
                  <p className="text-sm text-zinc-400">Used to automatically solve CAPTCHAs while scraping Google Maps and Google Search. Create an account at 2captcha.com, add $2-$5, and paste the API key into Settings. It will solve thousands of captchas automatically.</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-1">
              <Shield className="w-5 h-5 text-purple-400" />
            </div>
            <div className="space-y-4 w-full">
              <h2 className="text-xl font-semibold text-purple-100">Cheapest Proxy Options</h2>
              <p className="text-zinc-400 text-sm">Because scraping Google heavily will eventually result in rate limits, using a Proxy is highly recommended. Paste your proxy details into the Settings tab. The scraper will use these proxies to mask your IP address.</p>

              <div className="space-y-4 mt-4">
                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                  <div className="flex items-center gap-2 mb-1">
                    <Link className="w-4 h-4 text-purple-400" />
                    <h3 className="font-semibold text-zinc-200">1. Webshare.io</h3>
                  </div>
                  <p className="text-sm text-zinc-400 mb-2"><strong className="text-zinc-300">Cost:</strong> Starts at ~$3/month for 10 proxies.</p>
                  <p className="text-sm text-zinc-300">Excellent free tier (10 proxies free forever). Datacenter proxies work fine for basic scraping if rotated properly. Very easy to set up.</p>
                </div>

                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                  <div className="flex items-center gap-2 mb-1">
                    <Link className="w-4 h-4 text-purple-400" />
                    <h3 className="font-semibold text-zinc-200">2. IPRoyal</h3>
                  </div>
                  <p className="text-sm text-zinc-400 mb-2"><strong className="text-zinc-300">Cost:</strong> ~$1.75/GB for Residential Proxies (Pay as you go).</p>
                  <p className="text-sm text-zinc-300">Residential IPs rarely get blocked by Google. Since LeadHunter doesn't download large files, 1GB will last a very long time.</p>
                </div>

                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                  <div className="flex items-center gap-2 mb-1">
                    <Link className="w-4 h-4 text-purple-400" />
                    <h3 className="font-semibold text-zinc-200">3. Proxy-Cheap</h3>
                  </div>
                  <p className="text-sm text-zinc-400 mb-2"><strong className="text-zinc-300">Cost:</strong> ~$5/GB for Residential, ~$2/month for Datacenter.</p>
                  <p className="text-sm text-zinc-300">Fast and reliable without monthly subscriptions for residential IPs.</p>
                </div>
              </div>

              <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm text-yellow-200/80">
                <strong>Pro Tip:</strong> You can test if your proxy is working by checking the "Run Scraper in Headful mode" setting. This will visibly open the browser so you can watch it navigate through your proxy!
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  )
}
