[中文](README.md)

# Koi pond

This repository is a static site. A colored ASCII portrait of Ultraman Tiga assembles from the center of the screen. After 1.8 seconds the view becomes a dot-matrix koi pond. A calm click on the water counts one feed. A fast pointer makes nearby fish scatter.

The Tiga portrait was supplied by a visitor for personal display on this page. It is not official Ultraman merchandise. [daoho.dev](https://daoho.dev) is the visual reference for the pond. The code, the glyphs, and the colors were written for this site.

## Open it locally

Install Node.js 22. From the repository root, do this.

1. Run `npm install`.
2. Run `npm run dev`.
3. Open the local address printed in the terminal.

To view the same files the deploy serves, use the production build.

1. Run `npm run build`.
2. Run `npm run preview`.
3. Open `http://127.0.0.1:4173/`.

An unknown path returns the text "这里没有页面。" and a link back to the home page.

## Deploy on Cloudflare Pages

Set the build command to `npm run build`. Set the output directory to `dist`. Leave out any rewrite that sends every path to `index.html`, so an unknown path can use `404.html`.

## Check

`npm test` covers cell size, feeding and scare, a still pond, and the portrait reveal. `npm run cells:check` confirms that `src/generated/tiga-pack.ts` still comes from `assets/tiga-clean.png` through `scripts/tiga-to-cells.mjs`. Run `npm run cells` to generate it again.

With the preview already running, `npm run prove` drives the installed Chrome through skip, feed, reduced motion, and the frame interval. The commands and the numbers are in [PROOF.md](PROOF.md).

## Decisions

The page structure lives in this file. There is no separate `DESIGN.md`.

The loader and the pond share `gridMetrics`. Below a viewport width of 720 the cell is 18 pixels. At 720 and above the cell is 12 pixels. The portrait reveals from the center outward over 1800 milliseconds. Skip, Esc, or a click on the picture enters the pond immediately. When the system asks for reduced motion, the first frame is the full portrait, the pond stays still, and a calm click still counts a feed.

Animation pauses when the page leaves the screen or the browser hides the tab. The accent is the blue from Tiga's color timer. Koi bodies do not use that blue. `localStorage` stores only the feed count, under the key `feeds`. Light and dark follow the system. A manual switch does not survive reload.

The 404 page is two short lines. Do not put the ascii-magic-art pieces ocean-sunset or starry-ridge on this site.

The license is MIT. Third-party licenses are in [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
