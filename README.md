# Copilot usage dashboard

A static dashboard for GitHub Copilot usage metrics. It shows whether acceptances, lines of code, and active users are rising. The page starts empty. Connect with a token, or upload a report.

The page reads the fields documented in [Copilot usage metrics](https://docs.github.com/en/copilot/reference/copilot-usage-metrics/copilot-usage-metrics) and the [REST report endpoints](https://docs.github.com/en/rest/copilot/copilot-usage-metrics). It does not show spend, credits, seats, or invoices.

## Timeframe

Charts, summary cards, and the daily table follow the timeframe control. Dates are UTC calendar days, the same `YYYY-MM-DD` values as the report `day` field. Presets are this month and last month. Custom uses an inclusive from/to range. All loaded shows every day in the file.

The REST API has no start or end parameter. A one-day selection calls `enterprise-1-day` or `organization-1-day` with the documented `day` query. Any other live connect calls `enterprise-28-day/latest` or `organization-28-day/latest`, then filters the rows. If that file is missing days inside a range of 31 or fewer, the page requests each missing day with `day`. A longer gap is left for an uploaded NDJSON file. Signed download URLs that the browser cannot fetch are shown so you can drop the files yourself.

Lines added use `loc_added_sum`. Lines suggested to add use `loc_suggested_to_add_sum`. Both are summed across the visible days. The Actions collector in a fork is a separate model: it writes `public/data/series.json`. This page does not run that collector.

## Load your own report in the browser

1. Create a classic personal access token.
   For an enterprise, grant `manage_billing:copilot` or `read:enterprise`.
   For an organization, grant `read:org`.
   Fine-grained tokens need "View Enterprise Copilot Metrics" or "View Organization Copilot Metrics".
   The enterprise policy "Copilot usage metrics" must be enabled.
2. Choose Enterprise or Organization.
3. Paste a slug, or a URL such as `https://github.com/enterprises/your-slug`.
4. Paste the token and click **Connect**.

The token is stored in `sessionStorage` for this tab. **Clear** removes it. The page calls `api.github.com` from the browser. It requests the latest 28-day report (`enterprise-28-day/latest` or `organization-28-day/latest`) and then downloads each `download_links` URL with a bare fetch. `Authorization`, `Accept`, and `X-GitHub-Api-Version` are sent only to `api.github.com`. A custom `Accept` on the signed file URL forces a CORS preflight that the file host rejects.

If the API call or the file download is blocked, the page says which step failed. Download the NDJSON and use the upload path below. Nothing on this site receives the token. Charts stay empty until a live report or an uploaded file loads. A fork that publishes `public/data/series.json` still shows that snapshot.

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
