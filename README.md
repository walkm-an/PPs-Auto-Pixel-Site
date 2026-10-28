[English](README.en.md)

# 锦鲤池

这是一个静态页面。打开后，彩色 ASCII 迪迦从画面中心逐格出现。1.8 秒后进入一池点阵锦鲤。点一下水面会计一次投喂。指针划得快，附近的鱼会散开。

迪迦形象由访客提供，只在这个页面上作个人展示，不是官方奥特曼商品。池塘的样子参考了 [daoho.dev](https://daoho.dev)。这里的代码、字形和配色是单独写的。

## 在本地打开

安装 Node.js 22，然后在仓库根目录执行。

1. 运行 `npm install`。
2. 运行 `npm run dev`。
3. 用浏览器打开终端打印的本地地址。

要看和部署结果相同的页面，改走下面三步。

1. 运行 `npm run build`。
2. 运行 `npm run preview`。
3. 打开 `http://127.0.0.1:4173/`。

未知路径会返回「这里没有页面。」，并链回首页。

## 部署到 Cloudflare Pages

构建命令填 `npm run build`。输出目录填 `dist`。不要添加把所有路径改写到 `index.html` 的规则，这样未知地址才会用到 `404.html`。

## 检查

`npm test` 覆盖格子尺寸、投喂和惊吓、静止的池塘，以及肖像揭示。`npm run cells:check` 确认 `src/generated/tiga-pack.ts` 仍由 `scripts/tiga-to-cells.mjs` 从 `assets/tiga-clean.png` 生成。要重新生成，运行 `npm run cells`。

预览已经在跑时，`npm run prove` 会用本机 Chrome 走一遍跳过、投喂、静止和帧间隔。命令和数字记在 [PROOF.md](PROOF.md)。

## 决定

页面结构写在这里，没有单独的 `DESIGN.md`。

加载页和池塘共用 `gridMetrics`。视口宽度小于 720 时，格子是 18 像素，否则是 12 像素。肖像从中心向外出现，时长 1800 毫秒。跳过、Esc，或点画面，都会立刻进入池塘。系统开启减少动态效果时，第一帧就是完整肖像，池塘保持不动，点一下仍然会计投喂。

页面离开屏幕，或浏览器把标签页藏起来时，动画暂停。强调色是迪迦计时器的蓝。锦鲤身体不用这个蓝。`localStorage` 只保存投喂次数，键名是 `feeds`。明暗跟随系统。手动切换在刷新后不会留下。

404 页只有两行字。不要把 ascii-magic-art 的 ocean-sunset 或 starry-ridge 放进这个站点。

许可证是 MIT。第三方许可见 [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md)。
