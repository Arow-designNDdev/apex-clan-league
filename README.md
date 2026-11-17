# Apex Clan League: website version

A CWL league site with a public live leaderboard and a password-protected leader mode.
Leaders log in, add their clans, pull each CWL day's attacks from the Clash of Clans API,
and fill in army left by hand. Everyone else just opens the link.

## What is in the folder

| Path | What it is |
| --- | --- |
| `public/index.html` | The whole front end (leaderboard, attacks, clans, titles, rules, leader tools) |
| `public/assets/` | Town hall icons, title videos, background, fonts |
| `netlify/functions/api.mjs` | The server code: login, saving data, Clash API calls |
| `server.mjs` | Runs the same site on your own computer instead of Netlify |
| `netlify.toml`, `package.json` | Netlify settings |
| `.env.example` | The secrets the server needs |

## 1. Clash API key

Create the key at developer.clashofclans.com and allow this IP address: **45.79.218.79**
(that is the RoyaleAPI proxy). The server uses `https://cocproxy.royaleapi.dev/v1` by default.

## 2. Deploy on Netlify

1. Put this folder in a GitHub repository.
2. On Netlify choose **Add new site, Import an existing project** and pick the repository.
   The settings come from `netlify.toml`, so just deploy.
3. In **Site configuration, Environment variables** add three values, then redeploy:
   - `SUPREME_PASSWORD`: the supreme leader's password (make it long). If you already set
     `LEADER_PASSWORD` it keeps working as the supreme password, so you can leave it
   - `SESSION_SECRET`: any long random string (30+ characters)
   - `COC_TOKEN`: your Clash API key
4. Open the site. Data is saved in Netlify Blobs, so it survives redeploys.

## Who can do what

- **Supreme leader** (name `supreme`, password from `SUPREME_PASSWORD`): everything a leader can do, plus the
  **Admin** tab: create leader accounts, ban or unban them, reset their passwords, delete them, read the
  activity log of everything leaders changed, and download or restore a backup.
  To change the supreme password itself, change `SUPREME_PASSWORD` in Netlify and redeploy.
- **Leaders** (made by the supreme leader): add clans, pull war data, edit and delete attacks, enter army left,
  link accounts. A banned leader is logged out on their next click.
- **Everyone else** just views.

## Phones and exports

- **On a phone** the site becomes an app-style layout: a floating bottom bar (Board, Attacks, Clans, Titles, More),
  a season hero card with CWL day progress, swipeable top-3 cards, card-style rows, and bottom sheets.
  Leaders get Entry in the bar. Open the site in the phone browser and choose **Add to Home Screen** to install it
  like an app (it has an app icon and opens full screen).
- **Export (PC, leader mode):** the leaderboard page shows **Export leaderboard**. Pick Top 10, 15, 20 or Everyone,
  then download an **Image (PNG)**, an **Animated GIF** (podium rises, scores count up, rows slide in), or a **PDF**.
  PNG also has **Copy image**. A live preview with a **Preview animation** button is shown first.
- Fonts are now bundled with the site, so it no longer depends on Google Fonts.

## Scoring changes in this version

- **Bonus:** Speed and Keep now both count and add together. The first 15 points count in full and anything above
  counts divided by 2, so the best possible bonus is 22.5 (it was 15).
- **Top-TH bonus:** a player at the highest Town Hall (TH18) who hits another TH18 gets +0.08 on W
  (hitting up one TH is +0.10).
- **Army left** is three levels (33% or less, 34 to 65%, 66% or more) and is entered with a snapping slider or buttons.
- The supreme leader can change the top-TH bonus, the highest TH, the bonus cap and the divisor in **Admin, Scoring**.
  Saving re-scores the whole league.
- The **Midas** title now needs an average bonus of 15, since the bonus can go above 15.

## Seasons and old CWL data

- The Clash API only shows the CWL that is current (or just ended). Every time you press **Get war data**, the
  league's **war tags are saved** (28 per season). If the CWL has already ended and the API no longer lists it,
  the saved war tags are used, so you can still re-pull that season.
- When a CWL is over and everything is pulled and checked, the supreme leader opens **Admin, Season** and presses
  **Finish season**. The whole league (players, attacks, clans, titles) is stored under **Seasons**, and a fresh
  league starts. Clans and linked accounts stay; press **Refresh players** in Clan setup to load the next CWL roster.
- Anyone can open a past season from the **Seasons** tab. It is read only and looks exactly as it ended.
- War tags can only be saved by pulling while the CWL is still listed, so pull the whole season before the next war starts.

## 3. Running a league

1. Click **Leader**. Type `supreme` and your supreme password (or a leader name and password you were given).
2. **Clan setup** tab: type the clan tag and press **Add clan**. If the clan is in a CWL, its CWL
   players (usually 15) are added as the players taking part, with league icons and the clan badge.
   The rest of the clan goes in the picker on the Data entry tab. Add a second clan the same way.
   **Check connection** shows step by step what works (key, clan lookup, CWL group) if anything fails.
3. **Data entry** tab, **Get war data**: a preview opens with every CWL day played so far, who attacked,
   how, and who has not attacked yet. Tick what you want (or tick a whole day with the Day buttons) and press
   **Add**. Past days stay available all season. Getting data again later only offers attacks not logged yet.
4. The **Army left** queue lists everyone still missing it (blank counts as 0%). Fill it in with the
   quick buttons, the number boxes, or paste a list like `Ahnaf 30, Arow 60` and confirm.
5. **Attacks** tab: click any attack for the full score breakdown. Leaders can edit or delete it there.
   Attacks are grouped by CWL day.
6. **Multi-account** links several accounts under one name; the board shows the best account.

Everything saves automatically and is stored on the server, so it is still there when you come back ("Saved" appears bottom left). If two leaders edit at once,
the second one is told and reloaded with the latest data.

Add `?demo=1` to the address to see made-up demo data without touching the real league.

## Running it on your own computer instead

1. Install Node 20 or newer.
2. Copy `.env.example` to `.env` and fill in the three values.
3. Run `node --env-file=.env server.mjs` and open http://localhost:8888.
   Data is saved in `data/state.json`. To share it, expose the port with a tunnel
   (for example Cloudflare Tunnel).

## Honest notes

- The Clash API code was tested against a stand-in server built from the API's documented shape,
  not against the live API. On the first real run, check that players load, a CWL day pulls, and
  time left looks right (it is 180 seconds minus the attack duration).
- Netlify's free plan has usage limits that can change; check them if the league gets big.
- Rotate `SUPREME_PASSWORD` and `SESSION_SECRET` if you ever think they leaked
  (changing the secret logs everyone out).
