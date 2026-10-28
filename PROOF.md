# Proof

Numbers below come from the production build on this machine, except the Lighthouse run, which measured the previous script `index-DzkBWryN.js`. `npm test` passed 20 tests. `npm run cells:check` printed `cells ok 1350`. `npm run build` printed `css ok`.

## Build

```
npm run build
```

Vite 8.3.5 wrote `dist/assets/index-BSKNBACv.js` at 25.81 kB, with gzip shown as 14.68 kB. The same file is 25818 bytes raw. `gzip -c -n -9` of that file is 14338 bytes. The first-load script is under 50KB either way. Geist Mono Latin 400 is a separate woff2 of 9.86 kB.

## Frame rate

Command, with `npm run preview` already serving `http://127.0.0.1:4173/`. The same command was run twice in a row. Both exited 0. Each run created a new temporary Chrome profile and removed that directory before exiting.

```
node scripts/prove.mjs
```

Google Chrome 156.0.8078.47, headless, on Linux with 4 cores. `uptime` just before the pair read load average 0.00, 0.01, 0.00.

The script sampled `requestAnimationFrame` for 2 seconds, five times, after the pond was running. Each sample saw 120 or 121 callbacks. The median gap in every sample was 16.7 ms. That interval is 60 frames per second, limited by the display refresh. The callback duration median was 0.1 ms and the max in the set was 0.5 ms.

The script counted 0 page errors. A pair of pond frames differed by 263 sampled pixels on the first run and 447 on the second, so the canvas was changing. Koi snap to cells, so one pair of frames can be identical. The script samples up to eight pairs and keeps the first pair that changes. A background tab recorded 1 callback over 800 ms, then 26 callbacks on the first run and 25 on the second after the tab was visible again. With reduced motion, the pond scheduled 0 further callbacks over 800 ms (`stillRafDelta` 0).

This is one host, not a phone. A 30 fps phone was not measured. At a viewport width under 720 the cell is 18 pixels, and the unit tests lock a smaller fish count there.

## Lighthouse

One mobile run of `index-DzkBWryN.js`, the script from before this resize and clock fix. Lighthouse 12.8.2, form factor mobile, simulated slow 4G and a 4x CPU slowdown. Load average at the start was 0.25, 0.18, 0.10. The run reported no `runtimeError`.

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

`scripts/prove.mjs` also checked the running page. Both back-to-back runs exited 0. The second run started the feed count at 0.

`keeps every still fish inside the grid after the pond shrinks` builds a still desktop pond, steps it onto the phone grid, and checks that every fish is inside the new grid, that those fish use more than one column, and that another still step leaves them there.

`does not advance the portrait while the clock is paused` pauses the portrait clock and checks that a later timestamp paints the same cells and is not finished. Resuming and adding 200 ms paints more cells.

- At 250 ms with motion on, the phase is still `portrait`, and the center holds more ink than the corner.
- Skip, Escape, and a click on the canvas each reach `pond` within the 200 ms the script waits. That is inside the 1800 ms timeout. The click that enters the pond does not increment the feed count.
- A calm mouse click sets the count to 1. A fast mouse drag leaves it at 1. A slow touch sets it to 2. A fast touch leaves it at 2.
- Reduced motion at 200 ms is still `portrait`, with more than three times the ink of the moving portrait at 250 ms. The full portrait is [portrait-reduced.png](portrait-reduced.png).
- The theme control switches `data-theme` to `light` and the label to 「暗」. Reload clears `data-theme` and keeps `localStorage` key `feeds`.
- Footer widths of 390 and 320 CSS pixels do not overlap the skip button, and the page does not scroll sideways.
- `http://127.0.0.1:4173/missing` returns 404 and the text 「这里没有页面。」

Dark and light pond frames from that script are [pond-dark.png](pond-dark.png) and [pond-light.png](pond-light.png).
