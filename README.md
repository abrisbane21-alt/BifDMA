# BifDMA

A parody "cheat store" website for **bifdma.org**. It's a joke fan site about bifsterr's chat
constantly accusing him of cheating in Arena Breakout: Infinite.

Nothing on the site is real. Every "Buy" button goes to a fake checkout that is always out of
stock, and the footer and FAQ state that it's a parody. There is no product, no download, and no
payment form.

## Files

The website is in `site/`. The APIs behind it are Netlify Functions in `netlify/functions/`, and
their data lives in Netlify Blobs.

| File                                 | What it is                                                      |
| ------------------------------------ | --------------------------------------------------------------- |
| `site/index.html`                    | The main page (most of the jokes live here — edit freely)       |
| `site/styles.css`                    | Styling for every page                                          |
| `site/script.js`                     | Main page behaviour: games, reviews, clips, suggestion box, zap |
| `site/buy.html`, `site/buy.js`       | Where every Buy button goes: "out of stock", then tip bif on PayPal |
| `site/admin.html`, `site/admin.js`   | Admin mode (sign in with an admin key)                          |
| `site/favicon.svg`, `site/og.png`    | Tab icon and the preview image used when the link is shared     |
| `netlify/functions/reviews.mjs`      | `/api/reviews` — the reviews wall                               |
| `netlify/functions/safe.mjs`         | `/api/safe` — the Safe Simulator leaderboard                    |
| `netlify/functions/clips.mjs`        | `/api/clips` — clips admins add                                 |
| `netlify/functions/feedback.mjs`     | `/api/feedback` — the suggestion box (only admins can read it)  |
| `netlify/functions/track.mjs`        | `/api/track` — anonymous counts for the admin stats             |
| `netlify/functions/admin.mjs`        | `/api/admin` — sign-in check, site stats, managing admins       |
| `netlify/lib/auth.mjs`               | Works out whether a request comes from the owner or an admin    |
| `netlify/lib/shared.mjs`             | Word filter and other helpers the APIs share                    |
| `netlify.toml`, `package.json`       | Tells Netlify where the site and functions are                  |

To preview the pages locally, run `python3 -m http.server` inside `site/` and visit
http://localhost:8000. Anything that needs the APIs (reviews, leaderboard, clips, suggestions,
admin mode) only works on Netlify, so locally it shows a "couldn't load" message.

## Reviews

Anyone can post a review (name and up to 280 characters) and it shows on the wall straight away.
Only 5-star reviews are allowed: picking fewer stars pops up a joke and resets the rating to 5, and
the API refuses anything lower. The joke reviews above the wall are part of the page and never change.

To keep the wall usable, the API:

- blocks links, email addresses, phone numbers, slurs and "kys"-style messages,
- allows one review per minute from the same connection,
- silently drops posts from bots that fill in a hidden form field,
- stores only a salted hash of the poster's IP address (for the rate limit), never the IP itself.

## Safe Simulator leaderboard

Players join with a username (2–20 characters, unique, same word filter as reviews; names like
bif, bifsterr, Nova and Bartholomew are reserved). Joining gives the browser a secret key, so
nobody else can post scores under that name. The key is saved in that browser, which is how the
score keeps counting after you leave the site and come back.

Clicks happen in the browser, so the API limits how fast a score can grow:

- at most 20 reds per second of real time (unused time doesn't build up past a minute),
- new players carry over at most 1,000 reds from before they joined,
- one new name every 2 minutes from the same connection,
- every sync is numbered, so a batch resent after the page closed is never counted twice.

Once a player has joined, the "Reds found" counter on the page shows their leaderboard score (plus
any clicks not sent yet), so the two always match. The rare 1-in-1,000 drop is a purple item.

The board keeps the top 50 players; the page shows the top 20.

## Tips (the buy page)

Every Buy button on the main page leads to `buy.html`, which says the DMA is out of stock forever and
then offers an optional tip for bif's content through PayPal, plus free ways to support him. It's
worded so a tip can't be mistaken for buying anything.

To switch tipping on, put bif's PayPal link at the top of `site/buy.js`:

```js
const PAYPAL_LINK = "https://paypal.me/HIS_NAME";
```

With a `paypal.me` link, the amount someone picks ($2, $5, $10, $25) is filled in on PayPal for them;
"Other" lets them choose on PayPal. Any other PayPal link opens as it is. Until the link is set, the
button reads "Tipping opens soon" and does nothing. Change `CURRENCY_SYMBOL` there too if his PayPal
isn't in dollars. The site never handles the money; everything happens on PayPal.

## Admin mode

`https://bifdma.org/admin.html` is the admin area. Nothing on the public site links to it.

**The owner** signs in with the owner key. To set it up once:

1. In Netlify, open the site → **Site configuration** (may be called **Project configuration**) →
   **Environment variables** → **Add a variable**. Name it `REVIEWS_ADMIN_KEY` and set the value to a
   long password only you know. Then trigger a new deploy (**Deploys** → **Trigger deploy**).
2. Go to `admin.html` and sign in with that password.

**Making someone an admin:** as the owner, open the **Admins** tab, type their name and press
**Make admin**. The page shows their personal admin key once; send it to them. They sign in on
`admin.html` with it. **Revoke** stops their key working straight away. Only a hash of each key is
stored, so a lost key can't be recovered; revoke it and make a new one.

What admins can do (the owner can do all of it too):

| Tab           | What it does                                                                 |
| ------------- | ---------------------------------------------------------------------------- |
| Stats         | Visitors and page views (today, 7 days, all time, chart per day), how many people tried to buy a DMA, tip button presses, Bartholomew zaps, reviews, leaderboard players and reds, suggestions, clips, admins |
| Suggestions   | Read and delete what people sent through the suggestion box                  |
| Clips         | Add clips by pasting a Twitch clip link (or YouTube link) plus a title; delete clips |
| Reviews       | Delete reviews                                                               |
| Leaderboard   | Remove names from the Safe Simulator leaderboard                             |
| Admins        | Owner only: make and revoke admins                                           |

Until `REVIEWS_ADMIN_KEY` is set, nobody can sign in.

### Clips

Clips are stored as links and play in Twitch's or YouTube's own player when someone presses play,
so no video is hosted on the site (Netlify functions can't take uploads over ~6 MB anyway). They
appear in the "killcam" player just below the top of the main page, with the newest clip first as
"Exhibit A" and the rest in the evidence log beside it. The section (and its menu link) stays
hidden until there's at least one clip.

### Stats and privacy

The page sends an anonymous count when it's viewed, when someone lands on the out-of-stock page,
when someone presses the PayPal tip button, and when Bartholomew zaps someone. Only totals per day are kept. A visitor is counted once per day
using a salted hash of their IP address; the address itself is never stored.

## Putting it live on bifdma.org (Netlify + GoDaddy)

The site is hosted on Netlify from this repo, so the repo can stay private. Every push to the deployed
branch updates the site automatically.

### 1. Create the Netlify site

1. Sign up at netlify.com (the free plan is enough) and choose **Add new site** → **Import an existing
   project** → **GitHub**, then pick this repo.
2. Pick the branch the site is on and click **Deploy**. You don't need to fill in any build settings:
   `netlify.toml` tells Netlify to publish the `site/` folder and where the reviews function is.
3. In the site's configuration, change the site name to something neutral like `bifdma`, which gives
   the address `bifdma.netlify.app`.

### 2. Add the domain in Netlify

Open **Domain management** → **Add a domain**, enter `bifdma.org`, and confirm. Choose to keep DNS at
your current provider, not Netlify DNS. Netlify then shows the records to add in GoDaddy.

### 3. Point the domain at Netlify (GoDaddy)

In GoDaddy, go to **My Products** → **bifdma.org** → **DNS**. Then:

1. **Delete** the `A` record for `@` that says "Parked", and any Forwarding on the domain.
2. **Add** the records below. If Netlify's screen shows different values, use Netlify's.

   | Type  | Name | Value                   |
   | ----- | ---- | ----------------------- |
   | A     | @    | 75.2.60.5               |
   | CNAME | www  | `<site-name>.netlify.app` |

DNS usually updates within an hour, but it can take up to 24–48 hours. Netlify sets up HTTPS on its own
once the domain is working.
