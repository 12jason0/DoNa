// 데모 예시 이미지(public/demo/places/*.svg) 만들기. 한 번 만들어 커밋해 둠 — 바깥 이미지 서버를 안 쓰려고
// node scripts/demo/make-images.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { CATEGORY_STYLE, PLACES, TELEGRAM_DRAFTS } from "./data.mjs";

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public/demo/places");
mkdirSync(out, { recursive: true });

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

for (const [key, name, category] of [...PLACES, ...TELEGRAM_DRAFTS]) {
    const [dark, light, emoji] = CATEGORY_STYLE[category] ?? ["#555555", "#EEEEEE", "📍"];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient></defs>
<rect width="800" height="600" fill="url(#g)"/>
<text x="400" y="290" font-size="160" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
<text x="400" y="470" font-size="44" font-weight="700" fill="#ffffff" text-anchor="middle" font-family="sans-serif">${esc(name.replace(" (예시)", ""))}</text>
<text x="400" y="530" font-size="26" fill="#ffffff" fill-opacity="0.85" text-anchor="middle" font-family="sans-serif">${esc(category)} · DoNa 체험 데모 예시 이미지</text>
</svg>
`;
    writeFileSync(path.join(out, `${key}.svg`), svg);
}
console.log(`${PLACES.length + TELEGRAM_DRAFTS.length}개 이미지 → ${out}`);
