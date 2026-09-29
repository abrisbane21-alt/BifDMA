# BifDMA

A parody "cheat store" website for **bifdma.org**. It's a joke fan site about bifsterr's chat
constantly accusing him of cheating in Arena Breakout: Infinite.

Nothing on the site is real. Every "Buy" button goes to a fake checkout that is always out of
stock, and the footer and FAQ state that it's a parody. There is no product, no download, and no
payment form.

## Files

The website is in `site/`. The reviews API is a Netlify Function in `netlify/functions/`.

| File                             | What it is                                                           |
| -------------------------------- | -------------------------------------------------------------------- |
| `site/index.html`                | The main page (most of the jokes live here — edit freely)            |
| `site/styles.css`                | Styling for every page                                               |
| `site/script.js`                 | Excuse generator, Safe Simulator, reviews wall, menu, toasts, zap    |
| `site/buy.html`, `site/buy.js`   | Fake checkout page; every order ends in "Out of stock"               |
| `site/admin.html`, `site/admin.js` | Private page for deleting reviews and leaderboard names           |
| `site/favicon.svg`, `site/og.png`| Tab icon and the preview image used when the link is shared          |
| `netlify/functions/reviews.mjs`  | Reviews API at `/api/reviews` (stores reviews in Netlify Blobs)      |
| `netlify/functions/safe.mjs`     | Safe Simulator leaderboard API at `/api/safe`                        |
| `netlify/lib/shared.mjs`         | Word filter and helpers used by both APIs                            |
| `netlify.toml`, `package.json`   | Tells Netlify where the site and function are                        |

To preview the pages locally, run `python3 -m http.server` inside `site/` and visit
http://localhost:8000. The reviews wall and the leaderboard only work on Netlify, so locally
they show a "couldn't load" message.

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

The board keeps the top 50 players; the page shows the top 20.

### Deleting reviews and removing names

1. In Netlify, open the site → **Site configuration** (may be called **Project configuration**) →
   **Environment variables** → **Add a variable**. Name it `REVIEWS_ADMIN_KEY` and set the value to a
   long password only you know. Then trigger a new deploy (**Deploys** → **Trigger deploy**).
2. Go to `https://bifdma.org/admin.html`, enter that password and click **Load**. Delete reviews or
   remove leaderboard names from there. Changes can take up to 15 seconds to show for everyone.
   A removed name becomes free for anyone to take.

Until `REVIEWS_ADMIN_KEY` is set, nobody (including you) can delete reviews or remove names.

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
