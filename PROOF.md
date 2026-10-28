# Proof

Numbers below come from the production build on this machine. `npm test` passed 20 tests. `npm run cells:check` printed `cells ok 1350`. `npm run build` printed `css ok`.

## Build

```
npm run build
```

Vite 8.3.5 wrote `dist/assets/index-BM8Qji5j.js` at 25.91 kB, with gzip shown as 15.02 kB. The same file is 25915 bytes raw. `gzip -c -n -9` of that file is 14617 bytes. The first-load script is under 50KB either way. Geist Mono Latin 400 is a separate woff2 of 9.86 kB.

## Frame rate

Command, with `npm run preview` already serving `http://127.0.0.1:4173/`. This pass exited 0. The script still creates a new temporary Chrome profile and removes that directory before exiting.

```
node scripts/prove.mjs
```

Google Chrome 156.0.8078.47, headless, on Linux with 4 cores. `uptime` just before the pass read load average 0.10, 0.07, 0.01.

The script sampled `requestAnimationFrame` for 2 seconds, five times, after the pond was running. Each sample saw 120 or 121 callbacks. The median gap in every sample was 16.7 ms. That interval is 60 frames per second, limited by the display refresh. The callback duration median was 3 ms and the max in the set was 5 ms.

The script counted 0 page errors. A pair of pond frames differed by 7007 sampled pixels, so the canvas was changing. A background tab recorded 1 callback over 800 ms, then 26 callbacks after the tab was visible again. With reduced motion, the pond scheduled 0 further callbacks over 800 ms (`stillRafDelta` 0).

This is one host, not a phone. A 30 fps phone was not measured. At a viewport width under 720 the cell is 18 pixels, and the unit tests lock a smaller fish count there.

## Lighthouse

One mobile run of `index-BM8Qji5j.js`. Lighthouse 12.8.2, form factor mobile, simulated slow 4G and a 4x CPU slowdown. Load average at the start was 0.11, 0.07, 0.01. The run reported no `runtimeError`.

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

`scripts/prove.mjs` also checked the running page. This pass exited 0. The run started the feed count at 0.

`keeps every still fish inside the grid after the pond shrinks` builds a still desktop pond, steps it onto the phone grid, and checks that every fish is inside the new grid, that those fish use more than one column, and that another still step leaves them there.

`does not advance the portrait while the clock is paused` pauses the portrait clock and checks that a later timestamp paints the same cells and is not finished. Resuming and adding 200 ms paints more cells.

- At 250 ms with motion on, the phase is still `portrait`, and the center holds more ink than the corner.
- Skip, Escape, and a click on the canvas each reach `pond` within the 200 ms the script waits. That is inside the 1800 ms timeout. The click that enters the pond does not increment the feed count.
- A calm mouse click sets the count to 1. A fast mouse drag leaves it at 1. A slow touch sets it to 2. A fast touch leaves it at 2.
- Reduced motion at 200 ms is still `portrait`, with more than three times the ink of the moving portrait at 250 ms. The full portrait is [portrait-reduced.png](portrait-reduced.png).
- The theme control switches `data-theme` to `light` and the label to 「暗」. Reload clears `data-theme` and keeps `localStorage` key `feeds`.
- A 390 CSS pixel wide layout keeps the skip button and the footer on screen, and the page does not scroll sideways.
- `http://127.0.0.1:4173/missing` returns 404 and the text 「这里没有页面。」

Dark and light pond frames from that script are [pond-dark.png](pond-dark.png) and [pond-light.png](pond-light.png).

## Pond picture

The frames below are 1280 by 800 CSS pixels. Four dark frames and four light frames were taken after the pond was moving. [compare-dark.png](compare-dark.png) puts a crop of the reference collage on the left and the four dark frames on the right. [compare-light.png](compare-light.png) does the same for the light theme. The single frames are [shot-dark-1.png](shot-dark-1.png) through [shot-dark-4.png](shot-dark-4.png) and [shot-light-1.png](shot-light-1.png) through [shot-light-4.png](shot-light-4.png). Between `shot-dark-1` and `shot-dark-4`, 73715 of 256000 sampled pixels changed.

1. Drawing. The fish are solid squares on one screen lattice, with a lighter center and a darker rim. The reference uses smaller squares and more gray steps. Ours are coarser, about one square per 13 CSS pixels on a 1280 pixel wide view.
2. Body. The body follows a bending spine, the tail swings with the wag, and the patches are red, orange, white, and gray. The reference tail is a clearer fork, and the bend is less regular. Ours is a sine along the spine, and the body is thicker.
3. Size. A near fish is about a quarter of the viewport width and a far fish about a sixth. Bodies overlap. The reference leaves more open water between groups. Ours sit closer together.
4. Atmosphere. Rim and fin squares are partly transparent gray. A feed draws one dotted circle on the same lattice. Far fish are dimmer. The food square stays the timer blue. The reference ripples are lighter and sometimes nested. Ours is one ring. The light theme uses the same shapes on the light background.
