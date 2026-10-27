# Proof

Numbers below come from the production build on this machine. `npm test` passed 18 tests. `npm run cells:check` printed `cells ok 1350`. `npm run build` printed `css ok`.

## Build

```
npm run build
```

Vite 8.3.5 wrote `dist/assets/index-DzkBWryN.js` at 25.05 kB, with gzip shown as 14.46 kB. The same file is 25059 bytes raw. `gzip -c -n -9` of that file is 14119 bytes. The first-load script is under 50KB either way. Geist Mono Latin 400 is a separate woff2 of 9.86 kB.

## Frame rate

Command, with `npm run preview` already serving `http://127.0.0.1:4173/`.

```
node scripts/prove.mjs
```

Google Chrome 156.0.8078.47, headless, on Linux with 4 cores. `uptime` just before the previous pass of this command read load average 0.00, 0.03, 0.00. The pass recorded here is the next one. The median gap did not move. That pass predates `CELL` and `sameGrid`. Those two edits do not change `stepWorld` or `paintPond`.

The script sampled `requestAnimationFrame` for 2 seconds, five times, after the pond was running. Each sample saw 120 or 121 callbacks. The median gap in every sample was 16.7 ms. That interval is 60 frames per second, limited by the display refresh. The callback duration median was 0.1 ms and the max in the set was 0.4 ms.

The script counted 0 page errors. Between two pond frames, 294 sampled pixels differed, so the canvas was changing. A background tab recorded 1 callback over 800 ms, then 26 callbacks after the tab was visible again. With reduced motion, the pond scheduled 0 further callbacks over 800 ms (`stillRafDelta` 0).

This is one host, not a phone. A 30 fps phone was not measured. At a viewport width under 720 the cell is 18 pixels, and the unit tests lock a smaller fish count there.

## Lighthouse

One mobile run of the current build. Lighthouse 12.8.2, form factor mobile, simulated slow 4G and a 4x CPU slowdown. Load average at the start was 0.25, 0.18, 0.10. The run reported no `runtimeError`.

Performance score 100.

| Audit | Result |
| --- | --- |
| First Contentful Paint | 1.1 s |
| Largest Contentful Paint | 1.1 s |
| Total Blocking Time | 0 ms |
| Cumulative Layout Shift | 0 |
| Speed Index | 1.1 s |
| Time to Interactive | 1.1 s |

The Largest Contentful Paint element is the footer line 「迪迦形象由访客提供，仅作个人展示，并非官方奥特曼商品。」 The report is [lighthouse-mobile.report.html](lighthouse-mobile.report.html).

## Loader and input

`scripts/prove.mjs` also checked the running page. Exit code was 0.

- At 250 ms with motion on, the phase is still `portrait`, and the center holds more ink than the corner.
- Skip, Escape, and a click on the canvas each reach `pond` within the 200 ms the script waits. That is inside the 1800 ms timeout. The click that enters the pond does not increment the feed count.
- A calm mouse click sets the count to 1. A fast mouse drag leaves it at 1. A slow touch sets it to 2. A fast touch leaves it at 2.
- Reduced motion at 200 ms is still `portrait`, with more than three times the ink of the moving portrait at 250 ms. The full portrait is [portrait-reduced.png](portrait-reduced.png).
- The theme control switches `data-theme` to `light` and the label to 「暗」. Reload clears `data-theme` and keeps `localStorage` key `feeds`.
- Footer widths of 390 and 320 CSS pixels do not overlap the skip button, and the page does not scroll sideways.
- `http://127.0.0.1:4173/missing` returns 404 and the text 「这里没有页面。」

Dark and light pond frames from that script are [pond-dark.png](pond-dark.png) and [pond-light.png](pond-light.png).
