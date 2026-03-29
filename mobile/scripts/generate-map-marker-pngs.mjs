/**
 * 웹 map/page.tsx 의 createReactNaverMapIcon 과 동일한 흰 핀 + SVG 아이콘.
 * React Native 규칙: marker-foo.png, marker-foo@2x.png, marker-foo@3x.png (논리 34/42dp).
 */
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "assets", "map-markers");

/** @type {Record<string, string>} */
const MARKER_ICON_INNER = {
    restaurant: `<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" fill="none" stroke="#f97316" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 2v20" fill="none" stroke="#f97316" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" fill="none" stroke="#f97316" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    cafe: `<path d="M10 2v2M14 2v2M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1M6 2v2" fill="none" stroke="#92400e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    bar: `<path d="M17 11h1a3 3 0 0 1 0 6h-1M9 12v6M13 12v6M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 2 11 2s2 1.5 3 1.5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5ZM5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    play: `<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2ZM13 5v2M13 17v2M13 11v2" fill="none" stroke="#a855f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    bookstore: `<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" fill="none" stroke="#0d9488" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    landmark: `<path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01M9 18v.01" fill="none" stroke="#e11d48" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    default: `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="10" r="3" fill="none" stroke="#6b7280" stroke-width="2"/>`,
};

/**
 * @param {object} o
 * @param {keyof typeof MARKER_ICON_INNER} o.key
 * @param {number} o.baseSize 34 | 42
 * @param {number} o.iconBox 16 | 20
 */
function buildSvg({ key, baseSize, iconBox }) {
    const cx = baseSize / 2;
    const r = Math.round(baseSize * 0.41);     // 원 반지름
    const cy = r + 1;                           // 원 중심 y
    const tipY = baseSize - 1;                  // 뾰족한 끝 y

    // 원에서 bezier로 전환되는 지점 (~100도)
    const angRad = 100 * Math.PI / 180;
    const tx = Math.round(cx + r * Math.sin(angRad));
    const ty = Math.round(cy - r * Math.cos(angRad));
    const lx = Math.round(cx - r * Math.sin(angRad));

    // bezier 제어점 (크기 비례)
    const sc = baseSize / 34;
    const c1rx = Math.round(tx - sc);
    const c1ry = Math.round(ty + 6 * sc);
    const c2rx = Math.round(cx + 3 * sc);
    const c2ry = Math.round(tipY - 4 * sc);

    // 좌우 대칭
    const c2lx = Math.round(cx - 3 * sc);
    const c1lx = Math.round(lx + sc);

    const pinPath = [
        `M ${cx},${cy - r}`,
        `A ${r},${r} 0 0,1 ${tx},${ty}`,
        `C ${c1rx},${c1ry} ${c2rx},${c2ry} ${cx},${tipY}`,
        `C ${c2lx},${c2ry} ${c1lx},${c1ry} ${lx},${ty}`,
        `A ${r},${r} 0 0,1 ${cx},${cy - r}`,
        'Z',
    ].join(' ');

    const inner = MARKER_ICON_INNER[key];
    const iconTx = Math.round(cx - iconBox / 2);
    const iconTy = Math.round(cy - iconBox / 2);

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${baseSize}" height="${baseSize}" viewBox="0 0 ${baseSize} ${baseSize}">
  <path d="${pinPath}" fill="#ffffff"/>
  <g transform="translate(${iconTx},${iconTy})">
    <svg width="${iconBox}" height="${iconBox}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${inner}</svg>
  </g>
</svg>`;
}

/** @param {string} svgStr @param {string} outPath @param {number} w @param {number} h */
async function rasterize(svgStr, outPath, w, h) {
    await sharp(Buffer.from(svgStr))
        .resize(w, h, { fit: "fill", kernel: sharp.kernel.lanczos3 })
        .png()
        .toFile(outPath);
}

async function main() {
    fs.mkdirSync(OUT, { recursive: true });
    const keys = Object.keys(MARKER_ICON_INNER);
    const scales = [
        { suffix: "", mul: 1 },
        { suffix: "@2x", mul: 2 },
        { suffix: "@3x", mul: 3 },
    ];
    for (const key of keys) {
        const normalSvg = buildSvg({ key, baseSize: 34, iconBox: 16 });
        const selectedSvg = buildSvg({ key, baseSize: 42, iconBox: 20 });
        for (const { suffix, mul } of scales) {
            await rasterize(
                normalSvg,
                path.join(OUT, `marker-${key}${suffix}.png`),
                34 * mul,
                34 * mul
            );
            await rasterize(
                selectedSvg,
                path.join(OUT, `marker-${key}-selected${suffix}.png`),
                42 * mul,
                42 * mul
            );
        }
        console.log("wrote", key, "(1x, @2x, @3x)");
    }
    console.log("done ->", OUT);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
