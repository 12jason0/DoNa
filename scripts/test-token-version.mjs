// token_version 로그인 무효화 확인. 실제 라우트 핸들러를 메모리 가짜 DB로 실행 (실 DB·외부 API 안 씀)
// 실행: node scripts/test-token-version.mjs
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-123";
process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID = "test-kakao";
process.env.KAKAO_CLIENT_SECRET = "test-kakao-secret";

// --- 가짜 prisma: users만 메모리에, select는 실제처럼 골라서 돌려줌 (tokenVersion 빼먹으면 드러나게) ---
const users = [];
const pick = (row, select) => (row && select ? Object.fromEntries(Object.keys(select).map((k) => [k, row[k]])) : row && { ...row });
const match = (row, where) => Object.entries(where).every(([k, v]) => (v && typeof v === "object" ? match(row, v) : row[k] === v)); // 복합 unique 키(unique_social_provider)는 펼쳐서 비교
const apply = (row, data) => {
    for (const [k, v] of Object.entries(data)) {
        if (v === undefined) continue;
        row[k] = v && typeof v === "object" && "increment" in v ? row[k] + v.increment : v;
    }
    return row;
};
const create = (data) => {
    const row = { id: users.length + 1, tokenVersion: 0, password: null, profileImageUrl: null, ageRange: null, gender: null, email: null, ...data };
    users.push(row);
    return row;
};
const userModel = {
    findUnique: async ({ where, select }) => pick(users.find((u) => match(u, where)), select) ?? null,
    findFirst: async ({ where, select }) => pick(users.find((u) => match(u, where)), select) ?? null,
    update: async ({ where, data, select }) => pick(apply(users.find((u) => match(u, where)), data), select),
    create: async ({ data, select }) => pick(create(data), select),
    upsert: async ({ where, update, create: c, select }) => {
        const u = users.find((x) => match(x, where));
        return pick(u ? apply(u, update) : create(c), select);
    },
};
const noop = new Proxy({}, { get: (_, m) => async () => (String(m).startsWith("findMany") ? [] : null) });
const fake = new Proxy({ user: userModel }, {
    get: (t, k) => (k === "$transaction" ? (fn) => fn(fake) : k in t ? t[k] : noop),
});
globalThis.__prisma = fake;

const jiti = createJiti(import.meta.url, { alias: { "@": path.join(root, "src") } });
const load = (p) => jiti.import(path.join(root, p));
const { NextRequest } = await import("next/server.js");

const req = (url, { method = "GET", token, cookie, json, text } = {}) => {
    const headers = {};
    if (token) headers.authorization = `Bearer ${token}`;
    if (cookie) headers.cookie = `auth=${cookie}`;
    if (json) headers["content-type"] = "application/json";
    if (text) headers["content-type"] = "application/x-www-form-urlencoded";
    return new NextRequest(`http://localhost${url}`, { method, headers, body: json ? JSON.stringify(json) : text });
};
const authCookie = (res) => res.cookies.get("auth")?.value;
const tvOf = (token) => jwt.decode(token).tv;

const login = await load("src/app/api/auth/login/route.ts");
const logout = await load("src/app/api/auth/logout/route.ts");
const session = await load("src/app/api/auth/session/route.ts");
const verify = await load("src/app/api/auth/verify/route.ts");
const submit = await load("src/app/api/submit-mission/route.ts");
const password = await load("src/app/api/users/password/route.ts");
const kakao = await load("src/app/api/auth/kakao/route.ts");
const kakaoNative = await load("src/app/api/auth/kakao/native/route.ts");
const apple = await load("src/app/api/auth/apple/route.ts");
const appleCallback = await load("src/app/api/auth/apple/callback/route.ts");
const { middleware } = await load("middleware.ts");

const isValid = async (token) => (await verify.GET(req("/api/auth/verify", { token }))).status === 200;
const sessionOk = async (cookie) => (await (await session.GET(req("/api/auth/session", { cookie }))).json()).authenticated;
const results = [];
const test = async (name, fn) => {
    try { await fn(); results.push(`PASS ${name}`); } catch (e) { results.push(`FAIL ${name}\n     ${e.message}`); }
};

const me = create({ email: "a@test.com", username: "tester", password: await bcrypt.hash("pw123456", 4) });
let oldToken;

await test("이메일 로그인: 토큰에 tv, 쿠키 발급, 1년 만료", async () => {
    const res = await login.POST(req("/api/auth/login", { method: "POST", json: { email: "a@test.com", password: "pw123456" } }));
    assert.equal(res.status, 200);
    oldToken = (await res.json()).token;
    assert.equal(authCookie(res), oldToken);
    assert.equal(tvOf(oldToken), 0);
    const { iat, exp } = jwt.decode(oldToken);
    assert.equal(exp - iat, 60 * 60 * 24 * 365);
    assert.ok(await isValid(oldToken));
});

await test("로그아웃 → token_version +1, 쿠키 삭제", async () => {
    const res = await logout.POST(req("/api/auth/logout", { method: "POST", token: oldToken }));
    assert.equal(res.status, 200);
    assert.equal(me.tokenVersion, 1);
    assert.equal(authCookie(res), "");
});

await test("로그아웃 후 예전 토큰 → 401 (verify·submit-mission·session·middleware)", async () => {
    assert.equal((await verify.GET(req("/api/auth/verify", { token: oldToken }))).status, 401);
    assert.equal((await submit.GET(req("/api/submit-mission?chapterId=1", { token: oldToken }))).status, 401);
    assert.equal((await submit.GET(req("/api/submit-mission?chapterId=1", { cookie: oldToken }))).status, 401);
    assert.equal(await sessionOk(oldToken), false);
    const mw = await middleware(req("/login", { cookie: oldToken }));
    assert.equal(mw.headers.get("location"), null, "무효 토큰이면 /login에 그대로 들어가야 함");
});

await test("tv 없는 예전 토큰은 token_version 0이면 통과, 1이면 401", async () => {
    const legacyUser = create({ email: "old@test.com", username: "old" });
    const legacy = jwt.sign({ userId: legacyUser.id, name: "old" }, process.env.JWT_SECRET, { expiresIn: "365d" });
    assert.ok(await isValid(legacy));
    assert.equal(await sessionOk(legacy), true);
    assert.equal((await submit.GET(req("/api/submit-mission?chapterId=1", { cookie: legacy }))).status, 200);
    const mw = await middleware(req("/login", { cookie: legacy }));
    assert.equal(new URL(mw.headers.get("location")).pathname, "/", "유효 토큰이면 /login → / 리다이렉트");
    const legacyMe = jwt.sign({ userId: me.id, name: "tester" }, process.env.JWT_SECRET, { expiresIn: "365d" });
    assert.equal(await isValid(legacyMe), false);
});

await test("다시 로그인하면 새 tv(1)로 발급되고 통과", async () => {
    const res = await login.POST(req("/api/auth/login", { method: "POST", json: { email: "a@test.com", password: "pw123456" } }));
    const token = (await res.json()).token;
    assert.equal(tvOf(token), 1);
    assert.ok(await isValid(token));
});

await test("비밀번호 변경 → +1, 지금 기기는 새 토큰, 예전 토큰 401", async () => {
    const before = (await (await login.POST(req("/api/auth/login", { method: "POST", json: { email: "a@test.com", password: "pw123456" } }))).json()).token;
    const res = await password.PUT(req("/api/users/password", { method: "PUT", token: before, json: { currentPassword: "pw123456", newPassword: "newpw1234" } }));
    assert.equal(res.status, 200);
    const { token } = await res.json();
    assert.equal(me.tokenVersion, 2);
    assert.equal(authCookie(res), token);
    assert.ok(await isValid(token));
    assert.equal(await isValid(before), false);
});

// 외부 API(카카오) 응답 흉내
globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("kauth.kakao.com")) return Response.json({ access_token: "kakao-at" });
    if (u.includes("kapi.kakao.com")) return Response.json({ id: 777, properties: { nickname: "카카오" }, kakao_account: { email: "k@test.com" } });
    throw new Error(`unexpected fetch ${u}`);
};

await test("카카오 웹 로그인: 가입·재로그인, 로그아웃 뒤엔 새 tv", async () => {
    const r1 = await kakao.POST(req("/api/auth/kakao", { method: "POST", json: { code: "c" } }));
    assert.equal(r1.status, 200, JSON.stringify(await r1.clone().json()));
    const t1 = (await r1.json()).token;
    assert.equal(authCookie(r1), t1);
    assert.ok(await isValid(t1));
    await logout.POST(req("/api/auth/logout", { method: "POST", cookie: t1 }));
    assert.equal(await isValid(t1), false);
    const t2 = (await (await kakao.POST(req("/api/auth/kakao", { method: "POST", json: { code: "c" } }))).json()).token;
    assert.equal(tvOf(t2), 1);
    assert.ok(await isValid(t2));
});

await test("카카오 네이티브 로그인 (Bearer)", async () => {
    const res = await kakaoNative.POST(req("/api/auth/kakao/native", { method: "POST", json: { accessToken: "kakao-at" } }));
    assert.equal(res.status, 200);
    const { token } = await res.json();
    assert.equal(authCookie(res), token);
    assert.equal(tvOf(token), 1);
    assert.ok(await isValid(token));
});

const appleIdToken = jwt.sign({ sub: "apple-1", email: "ap@test.com" }, "x");
await test("애플 앱 로그인 (identityToken)", async () => {
    const res = await apple.POST(req("/api/auth/apple", { method: "POST", json: { identityToken: appleIdToken } }));
    assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
    const token = authCookie(res);
    assert.ok(token && (await isValid(token)));
});

await test("애플 웹 콜백 (form_post) + 로그아웃 뒤 재로그인", async () => {
    const res = await appleCallback.POST(req("/api/auth/apple/callback", { method: "POST", text: `id_token=${appleIdToken}&state=/` }));
    const token = authCookie(res);
    assert.ok(token && (await isValid(token)));
    await logout.POST(req("/api/auth/logout", { method: "POST", cookie: token }));
    assert.equal(await isValid(token), false);
    const again = authCookie(await appleCallback.POST(req("/api/auth/apple/callback", { method: "POST", text: `id_token=${appleIdToken}&state=/` })));
    assert.equal(tvOf(again), 1);
    assert.ok(await isValid(again));
});

console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
