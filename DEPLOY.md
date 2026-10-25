# Deploying on GitHub Pages — checklist

1. **Repository** — create a repository (public, or private with Pages enabled on your plan) and push the package as is: `index.html` at the
   root, `modules/`, `assets/`, `templates/`. The `tests/` folder may stay (it is not loaded by any page) or be left out of the published branch.
2. **Pages** — Settings → Pages → Source: *Deploy from a branch* → branch `main`, folder `/ (root)`. Wait for the first build (1–3 minutes).
3. **Paths** — every link is relative (`./modules/…`, `../assets/…`), so the site works under `https://<user>.github.io/<repo>/` and under a
   custom domain without changes.
4. **Custom domain (optional)** — add a `CNAME` file with the domain, set the DNS records GitHub shows, then tick *Enforce HTTPS*.
5. **Share cards** — the pages use relative `og:image` paths (`assets/og-home.jpg`, `../assets/cia-share.jpg`). Some social networks need an
   absolute URL: once the final address is known, replace them with `https://<your-domain>/assets/…` (one search-and-replace).
6. **Smoke test after publishing** — open the hub; switch Arabic/English; open three tools from *Tools*; load an example in one; open
   *Dashboard*, *Integration map*, *Follow-up*; save an organization profile and issue the integrated report; open a tool on a phone.
7. **Caching** — after an update, GitHub Pages may serve the old files for a few minutes; a hard reload (Ctrl+Shift+R) shows the new version.
   The version is in `<meta name="cia-version">` of every page and in `CHANGELOG.md`.
8. **Data** — everything a user enters stays in that user's browser (`localStorage`); nothing is sent anywhere except the request form,
   which opens the user's own e-mail program. Tell users to export their organization profile and tool data (each tool's export) before
   clearing the browser or changing device.
9. **Fonts** — the pages load IBM Plex Sans / Noto Kufi Arabic from Google Fonts and fall back to system fonts when that is blocked.
10. **Next phase (shared platform)** — domain, database with the `cia-org:v1` schema, sign-in, organization workspaces, cloud storage and AI
    integration: see `claude/platform-handover.md` in the project.
