# Proof

Numbers below come from the production build on this machine. `npm test` passed 20 tests. `npm run cells:check` printed `cells ok 1350`. `npm run build` printed `css ok`.

## Build

```
npm run build
```

Vite 8.3.5 wrote `dist/assets/index-DOuhNoXF.js` at 26.73 kB, with gzip shown as 15.38 kB. The same file is 26737 bytes raw. `gzip -c -n -9` of that file is 14965 bytes. The first-load script is under 50KB either way. Geist Mono Latin 400 is a separate woff2 of 9.86 kB.

## Frame rate

Command, with `npm run preview` already serving `http://127.0.0.1:4173/`. This pass exited 0. The script still creates a new temporary Chrome profile and removes that directory before exiting.

```
node scripts/prove.mjs
```

Google Chrome 156.0.8078.47, headless, on Linux with 4 cores. `uptime` just before the pass read load average 0.11, 0.05, 0.01.

The script sampled `requestAnimationFrame` for 2 seconds, five times, after the pond was running. Each sample saw 120 callbacks. The median gap in every sample was 16.7 ms. That interval is 60 frames per second, limited by the display refresh. The callback duration median was 4.7 ms in four samples and 4.6 ms in the other. The max in the set was 8.4 ms. The wider fish raised the callback time, and the interval stayed on the refresh.

The script counted 0 page errors. A pair of pond frames differed by 2952 sampled pixels, so the canvas was changing. A background tab recorded 1 callback over 800 ms, then 26 callbacks after the tab was visible again. With reduced motion, the pond scheduled 0 further callbacks over 800 ms (`stillRafDelta` 0).

This is one host, not a phone. A 30 fps phone was not measured. At a viewport width under 720 the layout cell is 18 pixels, and the unit tests lock 6 fish there instead of 8. The drawing lattice is separate from that layout cell. It is the viewport width divided by 213, rounded, and at least 4. At 1280 CSS pixels that pitch is 6.

## Lighthouse

One mobile run of `index-DOuhNoXF.js`. Lighthouse 12.8.2, form factor mobile, simulated slow 4G and a 4x CPU slowdown. Load average at the start was 0.14, 0.07, 0.02. The run reported no `runtimeError`.

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

## Pond picture

The frames below are 1280 by 800 CSS pixels, taken after skip and one calm click. [compare-dark.png](compare-dark.png) puts a crop of the reference collage on the left and four dark frames on the right. [compare-light.png](compare-light.png) does the same for the light theme. The single frames are [shot-dark-1.png](shot-dark-1.png) through [shot-dark-4.png](shot-dark-4.png) and [shot-light-1.png](shot-light-1.png) through [shot-light-4.png](shot-light-4.png). [pond-dark.png](pond-dark.png) is the second dark frame. [pond-light.png](pond-light.png) is the second light frame. Between `shot-dark-1` and `shot-dark-4`, 36515 of 256000 sampled pixels changed.

1. Lattice. Reached. The pitch stayed at 6 CSS pixels on the 1280 pixel view. A row through `shot-dark-2` shows ink squares 5 pixels wide with centers 6 pixels apart. Each pigment is still mixed in 6 steps, and the wider shoulder shows more of those steps across one fish. Still short. The squares stay axis-aligned blocks, and one cross-section is not a smooth ramp of all six steps.
2. Body. Reached the middle size. The shoulder half-width is 0.148 of the length, twice the previous 0.074, and it falls to 0.028 at the peduncle. The snout is wide, so the head is round. The tail is two lobes that open toward the tip, and a pectoral paddle sits off the belly. In `shot-dark-2` the complete fish measured from 242 to 317 CSS pixels, about a fifth to a quarter of the width. Still short. The lobes are solid and short, so the fork is a blocky Y. The bend is still one sine. A fish that leaves the viewport loses part of the tail.
3. Crowd. Reached. Width under 720 stocks 6 fish. Any wider stocks 8. Heads push apart at 16 layout cells, which is 192 CSS pixels when the layout cell is 12, and a new fish takes the more open of six random samples. The frames leave a clear middle. A few fish still swim near one another, and a feed still draws the nearest fish inward. Eight is the top of the asked range.
4. Ripples. Reached. A calm click still starts four dotted rings on the same lattice. Over 1.6 seconds each ring grows and its opacity falls with the square of the remaining life. `shot-dark-2` and the light frames show several rings, and the later frames are larger and fainter. Still short. The rings are one gray. The smallest ring is a coarse polygon, because a circle on a 6 pixel lattice has few dots. The food mark is still one timer-blue square. The light theme uses the same shapes on the light background.
