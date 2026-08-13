# Model Advisor

A guided Q&A tool that recommends a coding model or agent based on your
priorities (performance, security, cost, latency, accuracy), scored
transparently against real SWE-bench Verified + CWEval benchmark results.

Ships with synthetic sample data. Upload your own `leaderboard_combined.csv`
in the app — it's parsed entirely in your browser and never sent anywhere.

## Run it locally first

```bash
npm install
npm run dev
```

Open the URL it prints (usually `http://localhost:5173`). Confirm everything
works before deploying.

## Deploy to GitHub Pages — step by step

**1. Create a new GitHub repository.**
Go to github.com → New repository → name it `model-advisor` (or whatever you
like — just remember the name for step 3).

**2. Push this project to that repository.**
From inside this folder:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/model-advisor.git
git push -u origin main
```

**3. Set the correct base path.**
Open `vite.config.js` and `package.json` and make sure both match your real
repo name exactly:
- `vite.config.js` → `base: "/model-advisor/"`
- `package.json` → `"homepage": "https://YOUR_USERNAME.github.io/model-advisor"`

If you named your repo something other than `model-advisor`, change both of
these to match (replace `model-advisor` with your actual repo name), or the
deployed site will load a blank page with broken asset paths.

**4. Install the deploy tool and deploy.**
```bash
npm install
npm run deploy
```
This builds the project and pushes the `dist/` folder to a `gh-pages` branch
automatically (the `gh-pages` package handles this — it's already listed in
`package.json`).

**5. Turn on GitHub Pages for that branch.**
On GitHub: your repo → Settings → Pages → under "Build and deployment",
set Source to "Deploy from a branch", Branch to `gh-pages`, folder `/ (root)`
→ Save.

**6. Wait about a minute, then visit your live site.**
```
https://YOUR_USERNAME.github.io/model-advisor/
```

## Updating the site later

Whenever you change the code:
```bash
npm run deploy
```
That's the only command needed — it rebuilds and republishes automatically.

## Project structure

```
model-advisor/
├── index.html          entry HTML
├── vite.config.js       build config (base path lives here)
├── package.json         dependencies + deploy script
└── src/
    ├── main.jsx          React mount point
    └── ModelAdvisor.jsx  the actual application
```
