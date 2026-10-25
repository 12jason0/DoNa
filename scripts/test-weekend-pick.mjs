// 주말 추천 코스 선택 + 목·금 알림 문구 확인. 실제 라우트 핸들러를 가짜 DB·메모리 캐시·가짜 Expo로 실행 (실 DB·Redis·푸시 안 씀)
// 실행: node scripts/test-weekend-pick.mjs
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import jwt from "jsonwebtoken";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// 로컬 Redis 주소는 운영이라 반드시 비워서 메모리 캐시로
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.KMA_API_KEY;
process.env.CRON_SECRET = "test-cron";
process.env.ADMIN_JWT_SECRET = "test-admin-secret";

// --- 가짜 prisma: 코스·푸시 토큰·유저(마케팅 동의)만 ---
const courses = [
    { id: 1, title: "성수 카페 투어", isPublic: true, createdAt: 1 },
    { id: 2, title: "비공개 코스", isPublic: false, createdAt: 2 },
];
const pick = (row, select) => (row && select ? Object.fromEntries(Object.keys(select).map((k) => [k, row[k]])) : row);
const matches = (row, where = {}) => Object.entries(where).every(([k, v]) => row[k] === v);
globalThis.__prisma = {
    course: {
        findFirst: async ({ where, select }) => pick(courses.find((c) => matches(c, where)), select) ?? null,
        findMany: async ({ where, select }) => courses.filter((c) => matches(c, where)).map((c) => pick(c, select)),
    },
    pushToken: {
        findMany: async () => [{ userId: 10, user: { username: "도나" } }],
        findUnique: async () => ({ userId: 10, token: "ExponentPushToken[x]", subscribed: true }),
    },
    user: { findUnique: async () => ({ isMarketingAgreed: true }) },
};

const sentPushes = [];
globalThis.fetch = async (url, init) => {
    if (String(url).startsWith("https://exp.host/")) {
        sentPushes.push(JSON.parse(init.body));
        return Response.json({ data: { status: "ok" } });
    }
    throw new Error(`unexpected fetch ${url}`);
};

const jiti = createJiti(import.meta.url, { alias: { "@": path.join(root, "src") } });
const load = (p) => jiti.import(path.join(root, p));
const { NextRequest } = await import("next/server.js");
const weekend = await load("src/app/api/cron/send-weekend-recommendation/route.ts");
const daily = await load("src/app/api/cron/send-daily-recommendation/route.ts");
const adminPick = await load("src/app/api/admin/weekend-pick/route.ts");
// 모듈 불러올 때 .env가 다시 읽혀서 한 번 더 비움 (Redis 클라이언트는 첫 사용 때 만들어짐)
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.KMA_API_KEY;

const adminCookie = `admin_auth=${jwt.sign({ role: "admin" }, process.env.ADMIN_JWT_SECRET)}`;
const adminReq = (method, json, cookie = adminCookie) =>
    new NextRequest("http://localhost/api/admin/weekend-pick", {
        method,
        headers: { cookie, ...(json ? { "content-type": "application/json" } : {}) },
        body: json ? JSON.stringify(json) : undefined,
    });
const cron = (mod, p) => mod.GET(new NextRequest(`http://localhost${p}`, { headers: { authorization: "Bearer test-cron" } }));
const lastPush = () => sentPushes.at(-1);

const results = [];
const test = async (name, fn) => {
    try { await fn(); results.push(`PASS ${name}`); } catch (e) { results.push(`FAIL ${name}\n     ${e.message}`); }
};

await test("관리자 아니면 주말 추천 코스 조회·저장 401", async () => {
    assert.equal((await adminPick.GET(adminReq("GET", null, ""))).status, 401);
    assert.equal((await adminPick.PUT(adminReq("PUT", { courseId: 1 }, ""))).status, 401);
});

await test("비공개·없는 코스는 고를 수 없음, 목록엔 공개 코스만", async () => {
    assert.equal((await adminPick.PUT(adminReq("PUT", { courseId: 2 }))).status, 400);
    assert.equal((await adminPick.PUT(adminReq("PUT", { courseId: 999 }))).status, 400);
    const { pick, courses: list } = await (await adminPick.GET(adminReq("GET"))).json();
    assert.equal(pick, null);
    assert.deepEqual(list.map((c) => c.id), [1]);
});

await test("코스 고르면 목 알림에 (광고)+코스 이름, 코스 상세로 이동, 보낸 뒤 자동 해제", async () => {
    const saved = await (await adminPick.PUT(adminReq("PUT", { courseId: 1 }))).json();
    assert.deepEqual(saved.pick, { id: 1, title: "성수 카페 투어" });
    assert.equal((await cron(weekend, "/api/cron/send-weekend-recommendation")).status, 200);
    const p = lastPush();
    assert.equal(p.title, "(광고) 이번 주말 추천 코스 💚");
    assert.match(p.body, /성수 카페 투어/);
    assert.match(p.body, /\n수신거부: 설정 > 알림$/);
    assert.equal(p.data.url, "/courses/1");
    assert.equal((await (await adminPick.GET(adminReq("GET"))).json()).pick, null);
});

await test("안 고르면 목 알림은 (광고)+날씨 문구, 홈 주말 코스로 이동", async () => {
    await cron(weekend, "/api/cron/send-weekend-recommendation");
    const p = lastPush();
    assert.match(p.title, /^\(광고\) /);
    assert.match(p.body, /\n수신거부: 설정 > 알림$/);
    assert.doesNotMatch(p.body, /성수 카페 투어/);
    assert.equal(p.data.url, "/?openMoreCourses=weekend");
});

await test("고른 뒤 해제하면 날씨 문구로", async () => {
    await adminPick.PUT(adminReq("PUT", { courseId: 1 }));
    assert.equal((await (await adminPick.PUT(adminReq("PUT", { courseId: null }))).json()).pick, null);
    await cron(weekend, "/api/cron/send-weekend-recommendation");
    assert.equal(lastPush().data.url, "/?openMoreCourses=weekend");
});

await test("금 12:10 알림: (광고) 오늘 저녁 데이트 어때요?", async () => {
    assert.equal((await cron(daily, "/api/cron/send-daily-recommendation")).status, 200);
    assert.equal(lastPush().title, "(광고) 오늘 저녁 데이트 어때요?");
    assert.equal(lastPush().body, "도나님에게 딱 맞는 코스 골라뒀어요 💚\n수신거부: 설정 > 알림");
});

await test("vercel.json: 오늘의 추천은 금요일만, 주말 알림은 목 20:00 그대로", async () => {
    const { readFile } = await import("node:fs/promises");
    const { crons } = JSON.parse(await readFile(path.join(root, "vercel.json"), "utf8"));
    const at = (p) => crons.find((c) => c.path === p)?.schedule;
    assert.equal(at("/api/cron/send-daily-recommendation"), "10 3 * * 5");
    assert.equal(at("/api/cron/send-weekend-recommendation"), "0 11 * * 4");
});

console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
