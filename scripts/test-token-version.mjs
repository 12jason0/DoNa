// token_version 로그인 무효화 + 애플 identity token 서명 검증 확인. 실제 라우트 핸들러를 메모리 가짜 DB로 실행 (실 DB·외부 API 안 씀)
// 실행: node scripts/test-token-version.mjs
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { generateKeyPair, exportJWK, SignJWT } from "jose";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-123";
process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID = "test-kakao";
process.env.KAKAO_CLIENT_SECRET = "test-kakao-secret";
process.env.APPLE_CLIENT_ID = "kr.io.dona.dona.sid";

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
// 모듈 불러올 때 .env가 읽혀서 운영 Redis 주소가 들어옴 → 비워서 레이트리밋·캐시가 운영 Redis에 안 가게
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
// 미들웨어가 부르는 /api/auth/session은 실제 session 핸들러로 연결
const realFetch = globalThis.fetch;
const sessionFetch = (url, init) => String(url).includes("/api/auth/session") ? session.GET(new NextRequest(String(url), init)) : null;
globalThis.fetch = async (url, init) => (await sessionFetch(url, init)) ?? realFetch(url, init);

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

await test("session: tv 0 토큰·tv 없는 토큰 + DB 1 → 비로그인 (쿠키·Bearer 둘 다)", async () => {
    const u = create({ email: "s@test.com", username: "s", tokenVersion: 1 });
    const tv0 = jwt.sign({ userId: u.id, name: "s", tv: 0 }, process.env.JWT_SECRET, { expiresIn: "365d" });
    const noTv = jwt.sign({ userId: u.id, name: "s" }, process.env.JWT_SECRET, { expiresIn: "365d" });
    for (const t of [tv0, noTv]) {
        assert.equal(await sessionOk(t), false);
        const viaBearer = await (await session.GET(req("/api/auth/session", { token: t }))).json();
        assert.equal(viaBearer.authenticated, false);
    }
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

// 애플 공개키(JWKS)는 테스트 키로 흉내, 토큰은 그 키로 서명
const appleKeys = await generateKeyPair("RS256");
const appleJwk = { ...(await exportJWK(appleKeys.publicKey)), kid: "test-kid", alg: "RS256", use: "sig" };
const signApple = (claims, { key = appleKeys.privateKey, aud = "kr.io.dona.dona", exp = "10m", iss = "https://appleid.apple.com" } = {}) =>
    new SignJWT(claims).setProtectedHeader({ alg: "RS256", kid: "test-kid" }).setIssuer(iss).setAudience(aud).setIssuedAt().setExpirationTime(exp).sign(key);

// 외부 API(카카오·애플 공개키) 응답 흉내
globalThis.fetch = async (url, init) => {
    const s = await sessionFetch(url, init);
    if (s) return s;
    const u = String(url);
    if (u.includes("kauth.kakao.com")) return Response.json({ access_token: "kakao-at" });
    if (u === "https://appleid.apple.com/auth/keys") return Response.json({ keys: [appleJwk] });
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

const appleIdToken = await signApple({ sub: "apple-1", email: "ap@test.com" }); // 앱: aud = 번들 ID
const appleWebIdToken = await signApple({ sub: "apple-1", email: "ap@test.com" }, { aud: "kr.io.dona.dona.sid" }); // 웹: aud = Services ID
await test("애플 앱 로그인 (identityToken)", async () => {
    const res = await apple.POST(req("/api/auth/apple", { method: "POST", json: { identityToken: appleIdToken } }));
    assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
    const token = authCookie(res);
    assert.ok(token && (await isValid(token)));
});

await test("애플 웹 콜백 (form_post) + 로그아웃 뒤 재로그인", async () => {
    const res = await appleCallback.POST(req("/api/auth/apple/callback", { method: "POST", text: `id_token=${appleWebIdToken}&state=/` }));
    const token = authCookie(res);
    assert.ok(token && (await isValid(token)));
    await logout.POST(req("/api/auth/logout", { method: "POST", cookie: token }));
    assert.equal(await isValid(token), false);
    const again = authCookie(await appleCallback.POST(req("/api/auth/apple/callback", { method: "POST", text: `id_token=${appleWebIdToken}&state=/` })));
    assert.equal(tvOf(again), 1);
    assert.ok(await isValid(again));
});

// 서명·aud·exp가 틀린 애플 토큰 → 앱·웹 콜백·웹 form_post 세 곳 모두 401, 쿠키·계정 안 생김
const appleEntries = [
    ["앱", (t) => apple.POST(req("/api/auth/apple", { method: "POST", json: { identityToken: t } }))],
    ["웹 콜백", (t) => appleCallback.POST(req("/api/auth/apple/callback", { method: "POST", text: `id_token=${t}&state=/` }))],
    ["웹 form_post", (t) => apple.POST(req("/api/auth/apple", { method: "POST", text: `id_token=${t}&state=/` }))],
];
const rejectsApple = async (token) => {
    const usersBefore = users.length;
    for (const [where, call] of appleEntries) {
        const res = await call(token);
        assert.equal(res.status, 401, `${where}: ${res.status}`);
        assert.equal(authCookie(res), undefined, `${where}: 쿠키가 발급됨`);
    }
    assert.equal(users.length, usersBefore, "계정이 생김");
};

await test("애플: 가짜 키로 서명한 토큰 → 401", async () => {
    const { privateKey } = await generateKeyPair("RS256");
    await rejectsApple(await signApple({ sub: "evil-1", email: "evil@test.com" }, { key: privateKey }));
});

await test("애플: 다른 audience 토큰 → 401", async () => {
    await rejectsApple(await signApple({ sub: "evil-2" }, { aud: "com.other.app" }));
});

await test("애플: 만료된 토큰 → 401", async () => {
    await rejectsApple(await signApple({ sub: "evil-3" }, { exp: Math.floor(Date.now() / 1000) - 60 }));
});

await test("애플: 서명 없는 예전 형태(HS256)·다른 issuer 토큰 → 401", async () => {
    await rejectsApple(jwt.sign({ sub: "evil-4", aud: "kr.io.dona.dona", iss: "https://appleid.apple.com" }, "x", { expiresIn: "10m" }));
    await rejectsApple(await signApple({ sub: "evil-5" }, { iss: "https://evil.example.com" }));
});

await test("애플 앱: appEmail로 남의 이메일을 보내도 그 계정으로 로그인 안 됨, 이메일도 안 붙음", async () => {
    const victim = create({ email: "victim@test.com", username: "victim" });
    const appLogin = async (sub, email) => {
        const res = await apple.POST(req("/api/auth/apple", { method: "POST", json: { identityToken: await signApple({ sub }), email } }));
        assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
        return (await res.json()).user.id;
    };
    // 이미 있는 회원 이메일
    const id1 = await appLogin("attacker-1", "victim@test.com");
    assert.notEqual(id1, victim.id);
    assert.equal(users.find((u) => u.id === id1).email, null);
    // 아직 가입 안 한 이메일 선점도 안 됨 (나중에 카카오가 이메일로 계정 통합할 때 남의 계정에 붙는 길)
    const id2 = await appLogin("attacker-2", "notyet@test.com");
    assert.equal(users.find((u) => u.id === id2).email, null);
    assert.equal(users.filter((u) => u.email === "notyet@test.com").length, 0);
});

console.log(results.join("\n"));
const failed = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
