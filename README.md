# Nayma Unified Leads — Data & Analytics UI

Static dashboard (GitHub Pages ready) for the Cloud Run endpoint:

```text
GET https://nayma-unified-leads-data-795256461991.me-central1.run.app/?appId=<appId>&limit=<limit>
```

Response:

```json
{ "appId": "inbx", "count": 6, "limit": 100, "data": [ ... ] }
```

## Files

| File | Purpose |
|---|---|
| `index.html` | Dashboard shell (query panel, KPIs, charts, table) |
| `api.js` | API client: `LeadsAPI.fetchLeads({ baseUrl, appId, limit })`, analytics + CSV helpers |
| `app.js` | UI wiring (filters, Chart.js rendering, export) |
| `styles.css` | Styling, responsive |

No build step. `api.js` exposes a global `LeadsAPI` (works from `file://` too).

## API client usage

```html
<script src="./api.js"></script>
<script>
  LeadsAPI.fetchLeads({ appId: "inbx", limit: 100 }).then(r => {
    console.log(r.count, r.leads);
    const a = LeadsAPI.computeAnalytics(r.leads); // byCity/byRole/byCategory/...
    LeadsAPI.downloadCsv(r.leads, "leads-inbx.csv");
  });
  // Custom base: LeadsAPI.fetchLeads({ baseUrl: "https://…run.app", appId, limit })
</script>
```

Deep links: `index.html?appId=inbx&limit=100` (autoloads), `&autoload=1` forces load.

## Run locally

```bash
python3 -m http.server 8080
# open http://localhost:8080/?appId=inbx&limit=100
```

## Host on GitHub Pages

Option A — repo Settings → Pages → Deploy from branch → `main` / root.
Option B — included workflow (`.github/workflows/pages.yml`) deploys on push to `main`.

```bash
git init && git add . && git commit -m "leads dashboard"
git branch -M main && git remote add origin <your-repo-url> && git push -u origin main
```

> Note: the Cloud Run API must allow CORS for the Pages origin, otherwise the
> browser will block `fetch`. If you see a CORS error, enable CORS on the
> Cloud Run service (Firestore-backed API) for `https://<user>.github.io`.
