# Copilot usage dashboard

A static dashboard for GitHub Copilot usage metrics. It shows whether acceptances, lines of code, and active users are rising. Open the sample on GitHub Pages, or point it at your own enterprise.

The page reads the fields documented in [Copilot usage metrics](https://docs.github.com/en/copilot/reference/copilot-usage-metrics/copilot-usage-metrics) and the [REST report endpoints](https://docs.github.com/en/rest/copilot/copilot-usage-metrics). It does not show spend, credits, seats, or invoices.

## Use the sample

Open the GitHub Pages site. The charts load `public/fixtures/sample-usage.ndjson`. The banner says the numbers are synthetic.

## Load your own report in the browser

1. Create a classic personal access token.
   For an enterprise, grant `manage_billing:copilot` or `read:enterprise`.
   For an organization, grant `read:org`.
   Fine-grained tokens need "View Enterprise Copilot Metrics" or "View Organization Copilot Metrics".
   The enterprise policy "Copilot usage metrics" must be enabled.
2. Choose Enterprise or Organization.
3. Paste a slug, or a URL such as `https://github.com/enterprises/your-slug`.
4. Paste the token and click **Connect**.

The token is stored in `sessionStorage` for this tab. **Clear** removes it. The page calls `api.github.com` from the browser. It requests the latest 28-day report (`enterprise-28-day/latest` or `organization-28-day/latest`) and then downloads `download_links`. The `Authorization` header is sent only to `api.github.com`.

GitHub often blocks that call from a browser (CORS). When that happens, the page tells you. Use the upload path below. Nothing on this site receives the token.

## Upload a report

Download the NDJSON from the signed URL in the API response, or from a report you already saved.

Drop the file on **Upload a report**, or paste the file text and click **Load pasted report**.

Accepted shapes:

- NDJSON lines for an aggregated 1-day report, or for a users report
- One JSON object for an aggregated 28-day report, with `day_totals`
- A JSON array of those records

Per-user rows are summed by `day`. Active user counts are read only from aggregated rows (`daily_active_users`, `weekly_active_users`, `monthly_active_users`). Token totals are read only from `totals_by_cli.token_usage` and `totals_by_copilot_app.token_usage`. Other keys are ignored and listed under the charts.

## Publish from a fork

This template does not store an enterprise slug or a token in Actions secrets.

1. Fork the repository.
2. In the fork, add Actions secrets `GH_TOKEN` and `ENTERPRISE_SLUG`.
   `GH_TOKEN` is a PAT with the scopes above. Do not use the default `GITHUB_TOKEN` for the Copilot API.
   For an organization report, set secret `ORG_SLUG` and repository variable `COPILOT_SCOPE` to `org`.
3. Run the **Collect Copilot metrics (fork only)** workflow. It is `workflow_dispatch` only, and it skips `GaryJSAdv/copilot-usage-dashboard`.
4. To run it daily, uncomment the `schedule` block in `.github/workflows/collect-metrics.yml` on the fork.

The workflow writes `public/data/series.json` and commits it. The Pages workflow then deploys that file. The snapshot is public on the fork's Pages site. Do not commit a token. `series.json` holds usage counts only.

Each run merges new days into the existing file. A newer row for the same day replaces the older row.

## Enable GitHub Pages

1. On the repository that should host the site, open **Settings**, then **Pages**.
2. Set the source to **GitHub Actions**.
3. Merge this project to `main`. The **Pages** workflow builds the Vite app and deploys `dist`.

The site URL for this repository is `https://garyjsadv.github.io/copilot-usage-dashboard/`. The Vite `base` is `./`, so a fork works under its own project path.

## Local commands

```bash
npm install
npm test
npm run build
npm run dev
```

`npm run collect` needs `GH_TOKEN` and `ENTERPRISE_SLUG` in the environment. It writes `public/data/series.json` and does not print the token.
