# LeadHunter

An Electron application with React and TypeScript designed to automate finding, enriching, and emailing potential leads using Artificial Intelligence and Stealth Web Scraping.

## Basic Tutorial

Welcome to LeadHunter! This tool helps you automate the entire lead generation pipeline:

1. **Configure Settings:** Head to the `Settings` page and input your API keys (like OpenAI, OpenRouter, Google PageSpeed) to enable AI scoring and website analysis.
2. **Add Email Accounts:** On the `Settings` page, add the Gmail/SMTP accounts you want to use for outreach. 
3. **Scrape Leads:** Go to the `Scraper` page, type in your search query (e.g., "Plumbers in Austin, TX"), and click "Scrape". LeadHunter will use stealth automation to find Google Maps businesses and their websites.
4. **Review & Approve:** Go to the `Review` page. The AI will have automatically scored the leads based on their website quality and contact info. Click "Approve" for the ones you want to contact.
5. **Outreach Pipeline:** Once approved, the system takes over. Background tasks will draft personalized emails using AI, run email validation, and gradually send emails through your configured accounts on a schedule. You can view all activity on the `Dashboard` or the `Leads` tab.

---

## Integrating Services

LeadHunter relies on a few external APIs to be fully effective. All of these can be configured in the `Settings` tab inside the app.

### AI Engine (OpenAI / OpenRouter / Groq / Local)
LeadHunter uses AI to draft personalized emails and score lead websites. It supports any provider that uses the OpenAI standard format.

- **OpenRouter (Recommended):** Gives you access to top models like Anthropic's Claude 3.5 Sonnet, GPT-4o, and Llama 3 at cheap rates. 
  - *Provider:* `OpenRouter`
  - *API Key:* Get one at `openrouter.ai`
  - *Model:* e.g., `anthropic/claude-3.5-sonnet`
- **OpenAI:** 
  - *Provider:* `OpenAI`
  - *Model:* `gpt-4o-mini` or `gpt-4o`
- **Groq:** Fast and cheap Llama models.
  - *Provider:* `Groq`
  - *Model:* `llama3-70b-8192`
- **LM Studio / Ollama:** Run AI for free locally!
  - *Provider:* `LM Studio` or `Ollama`
  - *Model:* Leave blank or put your local model name.
  - *URL:* `http://localhost:1234/v1` (LM Studio) or `http://localhost:11434/v1` (Ollama)

### Google PageSpeed API
Used to determine if a prospect's website is slow or outdated (a great sales angle!).
- Get a free API key from the **Google Cloud Console**.
- Enable the **PageSpeed Insights API**.
- Paste the key in Settings.

### 2Captcha
Used to automatically solve CAPTCHAs while scraping Google Maps and Google Search.
- Create an account at `2captcha.com`.
- Add funds ($2 is enough for thousands of captchas).
- Paste the API key into Settings.

---

## Cheapest Proxy Options

Because scraping Google heavily will eventually result in rate limits, using a Proxy is highly recommended. You can paste your proxy details into the **Settings -> Network** tab. The scraper will use these proxies to mask your IP address.

Here are the best, budget-friendly options that work perfectly with LeadHunter:

1. **Webshare.io**
   - **Cost:** Starts at ~$3/month for 10 proxies.
   - **Pros:** Excellent free tier (10 proxies free forever), cheap datacenter IPs, very easy to setup.
   - **Type:** Datacenter (Datacenter proxies work fine for basic scraping if rotated properly).

2. **IPRoyal**
   - **Cost:** ~$1.75/GB for Residential Proxies (Pay as you go).
   - **Pros:** Residential IPs rarely get blocked by Google. Since LeadHunter doesn't download large files, 1GB will last a very long time.

3. **Proxy-Cheap**
   - **Cost:** ~$5/GB for Residential, ~$2/month for Datacenter.
   - **Pros:** Fast and reliable without monthly subscriptions for residential IPs.

*Note: You can test if your proxy is working by checking the "Run Scraper in Headful mode" setting. This will visibly open the browser so you can watch it navigate through your proxy!*

---

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```
