const fs = require('fs');
let code = fs.readFileSync('src/screens/Settings/index.tsx', 'utf-8');

code = code.replace(
  'return (\n    <div className=\"space-y-6 max-w-2xl\">',
  `return (
    <form className="space-y-6 max-w-2xl"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        save({
          developer_name: formData.get("developer_name") || "",
          proxy_enabled: formData.get("proxy_enabled") === "on",
          proxy_url: formData.get("proxy_url") || "",
          proxy_username: formData.get("proxy_username") || "",
          proxy_password: formData.get("proxy_password") || "",
          default_city: formData.get("default_city") || "",
          default_country: formData.get("default_country") || "",
          max_results_per_run: parseInt(formData.get("max_results_per_run") || "50"),
          scrape_delay_ms: parseInt(formData.get("scrape_delay_ms") || "1200"),
          email_finder_enabled: formData.get("email_finder_enabled") === "on",
          hunter_api_key: formData.get("hunter_api_key") || "",
          auto_send_enabled: formData.get("auto_send_enabled") === "on",
          auto_send_cron: formData.get("auto_send_cron") || "",
          scraper_headful: formData.get("scraper_headful") === "on",
          captcha_strategy: formData.get("captcha_strategy") || "pause",
          two_captcha_key: formData.get("two_captcha_key") || "",
          captcha_timeout_s: parseInt(formData.get("captcha_timeout_s") || "120"),
          smtp_host: formData.get("smtp_host") || "",
          smtp_port: parseInt(formData.get("smtp_port") || "587"),
          smtp_secure: formData.get("smtp_secure") === "on",
          smtp_username: formData.get("smtp_username") || "",
          smtp_password: formData.get("smtp_password") || "",
          smtp_from_name: formData.get("smtp_from_name") || "",
          smtp_from_email: formData.get("smtp_from_email") || "",
        });
      }}
    >`
);

code = code.replace(/onBlur=\{\(e\) => save\(\{ (.*?):.*? \}\)\}/g, 'name="$1"');
code = code.replace(/onChange=\{\(e\) => save\(\{ (.*?):.*? \}\)\}/g, 'name="$1"');

code = code.replace(
  '{saving && <p className="text-xs text-emerald-400">Saving…</p>}\n    </div>',
  `<div className="flex items-center gap-4">
        <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-sm font-medium transition-colors">
          Save Settings
        </button>
        {saving && <p className="text-xs text-emerald-400">Saving…</p>}
      </div>
    </form>`
);

fs.writeFileSync('src/screens/Settings/index.tsx', code);
