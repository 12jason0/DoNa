/**
 * 코스 지도용 숫자 마커 생성 (1~5)
 * - 웹처럼: 원형 헤드 + 꼬리 + 중앙 숫자 (깔끔한 번호 핀)
 * - iOS에서 MarkerOverlay children(Text) 렌더 이슈를 피하기 위해 PNG로 생성
 *
 * 출력:
 *  assets/map-markers/marker-play-step-{n}.png (+ @2x/@3x)
 *  assets/map-markers/marker-play-step-{n}-selected.png (+ @2x/@3x)
 */
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "assets", "map-markers");

const scales = [
    { suffix: "", size: 34 },
    { suffix: "@2x", size: 68 },
    { suffix: "@3x", size: 102 },
];

function pinSvg({ size, n, selected }) {
    const base = size;
    const cx = base / 2;

    // 꼬리를 포함해도 정사각 캔버스 안에 들어가도록 원을 조금 위로 올리고 반지름을 줄임
    const r = Math.round(base * 0.34);
    const cy = Math.round(base * 0.38);
    const tipY = Math.round(base * 0.92);
    const tailW = Math.round(base * 0.10);

    const bg = selected ? "#5347AA" : "#99c08e";
    const strokeW = Math.max(2, Math.round(base * 0.06));

    // 텍스트는 iOS에서도 일관되게 보이도록 굵게 + 중앙 정렬
    const fontSize = Math.round(base * 0.34);
    const textY = cy + Math.round(fontSize * 0.36);

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${base}" height="${base}" viewBox="0 0 ${base} ${base}">
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${bg}" stroke="#ffffff" stroke-width="${strokeW}"/>
  <path d="M ${cx - tailW} ${cy + r - 1} L ${cx + tailW} ${cy + r - 1} L ${cx} ${tipY} Z" fill="${bg}" />
  <text x="${cx}" y="${textY}"
    font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    font-size="${fontSize}" font-weight="900" fill="#ffffff" text-anchor="middle">${n}</text>
</svg>`;
}

async function genOne({ n }) {
    for (const s of scales) {
        const normalOut = path.join(OUT, `marker-play-step-${n}${s.suffix}.png`);
        const selOut = path.join(OUT, `marker-play-step-${n}-selected${s.suffix}.png`);

        const normalSvg = Buffer.from(pinSvg({ size: s.size, n, selected: false }));
        const selSvg = Buffer.from(pinSvg({ size: s.size, n, selected: true }));

        await sharp(normalSvg).png().toFile(normalOut);
        await sharp(selSvg).png().toFile(selOut);
    }
}

async function main() {
    fs.mkdirSync(OUT, { recursive: true });
    for (let n = 1; n <= 5; n++) {
        await genOne({ n });
        console.log("wrote step markers", n);
    }
    console.log("done ->", OUT);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});

