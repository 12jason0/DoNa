// 데모 빌드 준비 (Vercel 데모 프로젝트의 빌드 명령 npm run build:demo 가 next build 전에 실행)
// - middleware.ts → middleware.base.ts 로 옮기고, /api까지 덮는 데모 미들웨어를 middleware.ts로 씀
//   (Next 미들웨어 matcher는 상수만 돼서 환경변수로 넓힐 수 없음. 운영 빌드는 이 스크립트를 안 거쳐 원래 파일 그대로)
// - src/lib/demoBuildFlag.ts 를 true로 → 이 단계 없이 만든 빌드는 DEMO_MODE여도 DB를 열지 않음
// 로컬에서 돌렸다면 끝나고 node scripts/demo/prepare.mjs --restore
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const mw = path.join(root, "middleware.ts");
const base = path.join(root, "middleware.base.ts");
const flag = path.join(root, "src/lib/demoBuildFlag.ts");

const setFlag = (v) => writeFileSync(flag, readFileSync(flag, "utf8").replace(/DEMO_GATE_INSTALLED = (true|false)/, `DEMO_GATE_INSTALLED = ${v}`));

if (process.argv.includes("--restore")) {
    if (existsSync(base)) renameSync(base, mw);
    setFlag(false);
    console.log("[demo] 원래 middleware.ts 로 되돌렸어요.");
    process.exit(0);
}

if (process.env.DEMO_MODE !== "true") {
    console.error("[demo] DEMO_MODE=true 가 아니라서 데모 빌드를 준비하지 않아요. (운영 프로젝트는 npm run build 를 쓰세요)");
    process.exit(1);
}

if (!existsSync(base)) renameSync(mw, base);
writeFileSync(
    mw,
    `// scripts/demo/prepare.mjs 가 데모 빌드에서만 만든 파일. 원래 미들웨어는 middleware.base.ts
import type { NextRequest } from "next/server";
import { middleware as baseMiddleware } from "./middleware.base";
import { demoGuard } from "@/lib/demoMiddleware";

export async function middleware(req: NextRequest) {
    return demoGuard(req) ?? baseMiddleware(req);
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
`
);
setFlag(true);
console.log("[demo] 데모 미들웨어(/api 저장 차단) 설치 완료");
