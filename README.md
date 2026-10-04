# BifDMA

A parody "cheat store" website for **bifdma.org**. It's a joke fan site about bifsterr's chat
constantly accusing him of cheating in Arena Breakout: Infinite.

Nothing on the site is real. Every "Buy" button goes to a fake checkout that is always out of
stock, and the footer and FAQ state that it's a parody. There is no product, no download, and no
payment form.

## Files

The website is in `site/`. The APIs behind it are Vercel Functions in `api/`, and their data lives
in an Upstash Redis database connected to the Vercel project.

| File                                 | What it is                                                      |
| ------------------------------------ | --------------------------------------------------------------- |
| `site/index.html`                    | The main page (most of the jokes live here — edit freely)       |
| `site/styles.css`                    | Styling for every page                                          |
| `site/script.js`                     | Main page behaviour: games, reviews, clips, suggestion box, zap |
| `site/buy.html`, `site/buy.js`       | Where every Buy button goes: "out of stock", then tip bif on PayPal |
| `site/admin.html`, `site/admin.js`   | Admin mode (sign in with an admin key)                          |
| `site/favicon.svg`, `site/og.png`    | Tab icon and the preview image used when the link is shared     |
| `api/reviews.js`                     | `/api/reviews` — the reviews wall                               |
| `api/safe.js`                        | `/api/safe` — the Safe Simulator leaderboard                    |
| `api/clips.js`                       | `/api/clips` — clips admins add                                 |
| `api/feedback.js`                    | `/api/feedback` — the suggestion box (only admins can read it)  |
| `api/track.js`                       | `/api/track` — anonymous counts for the admin stats             |
| `api/admin.js`                       | `/api/admin` — sign-in check, site stats, managing admins       |
| `lib/store.js`                       | Reads and writes the data in Upstash Redis                      |
| `lib/auth.js`                        | Works out whether a request comes from the owner or an admin    |
| `lib/shared.js`                      | Word filter and other helpers the APIs share                    |
| `vercel.json`, `package.json`        | Tell Vercel to publish `site/` and run the functions in `api/`  |

To preview the pages locally, run `python3 -m http.server` inside `site/` and visit
http://localhost:8000. Anything that needs the APIs (reviews, leaderboard, clips, suggestions,
admin mode) only works once deployed on Vercel, so locally it shows a "couldn't load" message.

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

Clicks are sent in batches (at most every 10 seconds, and when the visitor leaves) and the board
refreshes once a minute while the page is open, which keeps the database well inside its free plan.

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

1. In Vercel, open the project → **Settings** → **Environment Variables**. Add one named
   `REVIEWS_ADMIN_KEY` with a long password only you know as the value. Then redeploy
   (**Deployments** → the newest one → **⋯** → **Redeploy**) so the site picks it up.
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
so no video is hosted on the site (the functions can't take uploads over ~4 MB anyway). They
appear in the "killcam" player just below the top of the main page, with the newest clip first as
"Exhibit A" and the rest in the evidence log beside it. The section (and its menu link) stays
hidden until there's at least one clip.

### Stats and privacy

The page sends an anonymous count when it's viewed, when someone lands on the out-of-stock page,
when someone presses the PayPal tip button, and when Bartholomew zaps someone. Only totals per day are kept. A visitor is counted once per day
using a salted hash of their IP address; the address itself is never stored.

## Putting it live on bifdma.org (Vercel + GoDaddy)

The site is hosted on Vercel's free (Hobby) plan from this repo, so the repo can stay private. Every
push to the repo's default branch updates the site automatically. Pushes don't cost anything (the
free plan allows 100 deploys a day). Asking for donations, like the tip page does, is allowed on
the free plan.

### 1. Create the Vercel project

1. Sign up at vercel.com with **Continue with GitHub**.
2. Choose **Add New…** → **Project**, and import this repo. If it isn't listed, choose
   **Adjust GitHub App Permissions** and give Vercel access to it.
3. Set **Project Name** to `bifdma` and leave every other setting as it is. `vercel.json` already
   tells Vercel to publish `site/` and run the functions in `api/`. Click **Deploy**.

### 2. Add the database (free)

Make the database on Upstash's own site; the free plan doesn't always show up when you add it from
inside Vercel.

1. Sign up at upstash.com (free, no card needed) and open the **Console**.
2. **Redis** → **Create Database**. Name it `bifdma`, pick the **Free** plan, and choose the region
   **US East (N. Virginia)**, which is next to where Vercel runs the site's functions. Click **Create**.
3. On the database's page, find the **REST API** section and its **.env** tab. It shows two values:
   `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Keep the token private; it works like a
   password for the data.
4. In Vercel, open the project → **Settings** → **Environment Variables** and add both, with exactly
   those names and the values from Upstash.
5. Add `REVIEWS_ADMIN_KEY` there too (see [Admin mode](#admin-mode)); you can reuse the password you
   used before.
6. Redeploy: **Deployments** → the newest one → **⋯** → **Redeploy**.

(Connecting Upstash from Vercel's **Storage** tab also works if it offers you the Free plan. It
sets the same connection details for you.)

The free database allows 500,000 commands a month. A page view uses about 4–9 and a
leaderboard sync uses 4. If it ever runs out, the reviews, leaderboard and other live parts stop
working until the next month, but the rest of the site stays up.

### 3. Add the domain in Vercel

Open **Settings** → **Domains** → **Add Domain**, enter `bifdma.org`, and accept the suggestion to
add `www.bifdma.org` too. Vercel then shows the DNS records to add in GoDaddy.

### 4. Point the domain at Vercel (GoDaddy)

In GoDaddy, go to **My Products** → **bifdma.org** → **DNS**. Then:

1. **Delete** the old records that pointed at Netlify: the `A` record for `@` (`75.2.60.5`) and the
   `CNAME` for `www` (ending in `netlify.app`). Also delete any "Parked" `A` record or Forwarding.
2. **Add** the records Vercel shows. They usually look like this; if Vercel's screen shows
   different values, use Vercel's.

   | Type  | Name | Value                  |
   | ----- | ---- | ---------------------- |
   | A     | @    | 76.76.21.21            |
   | CNAME | www  | cname.vercel-dns.com   |

DNS usually updates within an hour, but it can take up to 24–48 hours. Vercel sets up HTTPS on its
own once the domain is working.

Visitors only ever see `bifdma.org`. Vercel's preview links (for example in GitHub) include your
account name, but they're private to you by default.

### 5. Turn off Netlify

Once bifdma.org loads from Vercel, delete the old Netlify site (**Project configuration** →
**General** → **Delete project**). Otherwise Netlify keeps trying to deploy every push when its
credits reset.

### Moving from Netlify: what resets

The data on Netlify (reviews people posted, the leaderboard, suggestions, clips, admins and
stats) doesn't come across. The joke reviews written into the page are unaffected. Players keep
the reds counted in their browser. The page tells them the board was reset and fills in their old
name so they can rejoin in one click (with the usual 1,000-red carry-over limit). Admins need new
keys from the **Admins** tab, and clips need adding again.
