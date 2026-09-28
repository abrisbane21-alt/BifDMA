# BifDMA

A parody "cheat store" website for **bifdma.org**. It's a joke fan site about bifsterr's chat
constantly accusing him of cheating in Arena Breakout: Infinite.

Nothing on the site is real. Every "Buy" button opens a joke popup, and the footer and FAQ state that
it's a parody. There is no product, no download, and no payment form.

## Files

| File          | What it is                                                           |
| ------------- | -------------------------------------------------------------------- |
| `index.html`  | The whole page (all the jokes live here — edit freely)               |
| `styles.css`  | Styling                                                              |
| `script.js`   | Excuse generator, "payment declined" popup, fake purchase toasts     |
| `favicon.svg` | Browser tab icon                                                     |
| `og.png`      | Preview image shown when the link is shared on Discord/Twitter/etc. |

To preview locally, open `index.html` in a browser, or run `python3 -m http.server` in this folder
and visit http://localhost:8000.

## Putting it live on bifdma.org (Netlify + GoDaddy)

The site is hosted on Netlify from this repo, so the repo can stay private. Every push to the deployed
branch updates the site automatically.

### 1. Create the Netlify site

1. Sign up at netlify.com (the free plan is enough) and choose **Add new site** → **Import an existing
   project** → **GitHub**, then pick this repo.
2. Pick the branch the site is on. Leave the build command empty and set the publish directory to `.`
   (or leave it empty). Click **Deploy**.
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
