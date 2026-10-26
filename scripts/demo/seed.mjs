// 체험 데모 DB 만들기: 안전 확인 → 스키마(prisma db push) → 데모 표시(dona_demo.marker) → 예시 데이터 → (선택) 읽기 전용 역할
//
//   DEMO_SEED_DATABASE_URL="postgresql://...데모 DB 소유자 주소(-pooler 아닌 직접 주소)..." npm run demo:seed
//   읽기 전용 역할까지: DEMO_READER_PASSWORD="긴 랜덤 문자열" 도 같이 넣기
//
// 운영 DB 보호:
//  - 주소는 DEMO_SEED_DATABASE_URL 에서만 읽음 (DATABASE_URL 등 운영 이름은 안 읽고, 같은 값이면 중단)
//  - dona_demo.marker(이전에 이 스크립트가 만든 데모 DB 표시)가 없으면, public 표가 전부 비어 있을 때만 진행. 행이 하나라도 있으면 중단
//  - 회원·결제·푸시 토큰·제보자는 전부 지어낸 값 (example.com 메일, DEMO- 접두 토큰)
// 날짜는 실행 시점 기준으로 만들어서, 시간이 지나 "최근 7일" 그래프가 비면 다시 실행하면 됨
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import { PrismaClient } from "@prisma/client";
import { PLACES, REGIONS, TELEGRAM_DRAFTS } from "./data.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const url = process.env.DEMO_SEED_DATABASE_URL;

function fail(msg) {
    console.error(`\n❌ ${msg}\n`);
    process.exit(1);
}

// ---------- 1. 안전 확인 ----------
if (!url) fail("DEMO_SEED_DATABASE_URL 이 없어요. 데모용 새 DB 주소를 넣어 주세요.");
for (const k of ["DATABASE_URL", "PRISMA_DATABASE_URL", "DIRECT_URL"]) {
    if (process.env[k] && process.env[k] === url) fail(`DEMO_SEED_DATABASE_URL 이 ${k} 와 같아요. 운영 주소일 수 있어 중단합니다.`);
}
const target = new URL(url);
console.log(`대상 DB: ${target.hostname} / ${target.pathname.slice(1)} (사용자 ${target.username})`);

const connect = async () => {
    const c = new pg.Client({ connectionString: url }); // SSL은 주소의 sslmode=require 를 따름 (Neon 기본)
    await c.connect();
    return c;
};
let client = await connect();
const q = (sql, params) => client.query(sql, params).then((r) => r.rows);

const [{ marker }] = await q(`SELECT to_regclass('dona_demo.marker') IS NOT NULL AS marker`);
if (marker) {
    console.log("✓ 데모 DB 표시가 있어요 (이전에 만든 데모 DB) → 비우고 다시 채웁니다.");
} else {
    const tables = (await q(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`)).map((r) => r.tablename);
    const nonEmpty = [];
    for (const t of tables) {
        if (t === "_prisma_migrations") continue;
        const [{ has }] = await q(`SELECT EXISTS (SELECT 1 FROM "${t.replace(/"/g, '""')}" LIMIT 1) AS has`);
        if (has) nonEmpty.push(t);
    }
    if (nonEmpty.length > 0) {
        fail(`이 DB에는 이미 데이터가 있어요 (${nonEmpty.slice(0, 5).join(", ")}${nonEmpty.length > 5 ? " 외" : ""}).\n   운영 DB일 수 있어 아무것도 바꾸지 않고 중단합니다. 빈 새 DB 주소를 넣어 주세요.`);
    }
    console.log(`✓ 빈 DB예요 (public 표 ${tables.length}개, 모두 비어 있음).`);
}

// ---------- 2. 스키마 ----------
await client.end(); // db push가 따로 접속하므로 확인용 연결은 닫았다가 다시 엶
console.log("\n스키마 맞추는 중 (prisma db push)...");
const push = spawnSync("npx", ["prisma", "db", "push", "--skip-generate"], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url, PRISMA_DATABASE_URL: "" },
});
if (push.status !== 0) fail("prisma db push 실패. 위 메시지를 확인해 주세요.");
client = await connect();

// ---------- 3. 데모 표시 (앱은 이 표가 있는 DB에만 접속함: src/lib/demoDb.ts) ----------
await q(`CREATE SCHEMA IF NOT EXISTS dona_demo`);
await q(`CREATE TABLE IF NOT EXISTS dona_demo.marker (id int PRIMARY KEY, note text NOT NULL, seeded_at timestamptz NOT NULL DEFAULT now())`);
await q(`INSERT INTO dona_demo.marker (id, note) VALUES (1, 'DoNa 체험 데모 DB. 실제 회원 정보 없음') ON CONFLICT (id) DO UPDATE SET seeded_at = now()`);

const publicTables = (await q(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`)).map((r) => `"${r.tablename}"`);
if (publicTables.length) await q(`TRUNCATE TABLE ${publicTables.join(", ")} RESTART IDENTITY CASCADE`);

// ---------- 4. 예시 데이터 ----------
const prisma = new PrismaClient({ datasources: { db: { url } } });

// 실행할 때마다 같은 값이 나오게 고정 시드 난수
let seed = 20261026;
const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const int = (a, b) => a + Math.floor(rand() * (b - a + 1));
const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;
const ago = (days, jitterHours = 0) => new Date(NOW - days * DAY - Math.floor(rand() * jitterHours * 3600 * 1000));

// 지역
await prisma.region.createMany({ data: REGIONS.map((name, i) => ({ name, display_order: i })) });

// 장소 (공개 수준 예시)
const placeId = new Map();
let pid = 1;
for (const [key, name, category, , address, lat, lng, hours, description] of PLACES) {
    placeId.set(key, pid);
    await prisma.place.create({
        data: {
            id: pid++,
            name,
            category,
            address,
            latitude: lat,
            longitude: lng,
            opening_hours: hours || null,
            description,
            imageUrl: `/demo/places/${key}.svg`,
            status: "published",
            reservation_required: false,
            parking_available: category === "쇼핑",
            created_at: ago(120 - pid),
        },
    });
}
await prisma.placeClosedDay.createMany({
    data: [
        { place_id: placeId.get("gyeongbok"), day_of_week: 2, note: "화요일 휴궁" },
        { place_id: placeId.get("leeum"), day_of_week: 1, note: "월요일 휴관" },
        { place_id: placeId.get("hn-dining"), day_of_week: 1, note: "월요일 휴무" },
    ],
});

// 코스 (각 장소는 같은 동네 1km 안쪽으로 묶음). tips는 course_places.tips JSON (priority 3 = 카드뉴스 대표 팁)
const tip = (category, content, priority) => ({ category, content, ...(priority ? { priority } : {}) });
const COURSES = [
    {
        title: "서울숲 산책하고 성수 카페 투어", sub: "낮에 걷고, 커피 마시고, 소품 구경", region: "성수", grade: "FREE", concept: "카페투어,힐링", mood: ["감성", "힙한"], target: ["연인", "썸"], budget: "3~6만원", duration: "4시간",
        places: [
            ["seoulforest", [tip("BEST_SPOT", "사슴 우리 쪽 은행나무길이 사진 찍기 좋아요", 3), tip("WALKING", "입구에서 사슴 우리까지 15분 정도 걸어요")]],
            ["ss-cafe", [tip("SIGNATURE_MENU", "산미 있는 에티오피아 핸드드립이 대표 메뉴예요"), tip("WAITING", "주말 2~4시는 20분 정도 기다려요")]],
            ["ss-shop", [tip("GOOD_TO_KNOW", "2층에 커플 키링 만들기 코너가 있어요")]],
            ["ss-dining", [tip("SIGNATURE_MENU", "마르게리타 화덕 피자가 제일 많이 나가요"), tip("CAUTION", "저녁 6시 이후엔 예약 없이 가면 오래 기다려요")]],
        ],
    },
    {
        title: "성수 팝업 구경하고 와인 한 잔", sub: "브런치·저녁을 골라 만드는 선택형 코스", region: "성수", grade: "BASIC", concept: "이색데이트,술자리", mood: ["힙한", "활기찬"], target: ["연인", "친구"], budget: "6~10만원", duration: "5시간", selection: true,
        places: [
            ["ss-popup", [tip("GOOD_TO_KNOW", "인기 팝업은 앱으로 사전 예약을 받아요", 3)], "date", 1],
            ["ss-cafe", [tip("WAITING", "오픈 직후가 가장 한산해요")], "cafe", 1],
            ["ss-dining", [tip("SIGNATURE_MENU", "트러플 크림 파스타 추천")], "dinner", 1],
            ["ss-bar", [tip("VIBE_CHECK", "조명이 어둡고 조용해서 대화하기 좋아요")], "bar", 1],
        ],
    },
    {
        title: "연트럴파크 피크닉 데이트", sub: "숲길 걷다 덮밥 먹고 카페로", region: "연남·홍대", grade: "FREE", concept: "야외,가성비", mood: ["감성", "조용한"], target: ["연인", "썸"], budget: "3만원 이하", duration: "3시간",
        places: [
            ["gyeongui", [tip("BEST_SPOT", "연남동 쪽 잔디에 돗자리 펴기 좋아요", 3)]],
            ["yn-dining", [tip("WAITING", "11시 오픈 전 줄 서면 바로 들어가요"), tip("SIGNATURE_MENU", "연어 덮밥 + 미소장국 세트")]],
            ["yn-cafe", [tip("PHOTO_ZONE", "창가 자리 오후 4시 햇빛이 예뻐요")]],
        ],
    },
    {
        title: "홍대 인생네컷 찍고 이자카야", sub: "사진 남기고 하이볼 한 잔", region: "연남·홍대", grade: "BASIC", concept: "인생샷,술자리", mood: ["활기찬", "힙한"], target: ["친구", "썸"], budget: "3~6만원", duration: "3시간",
        places: [
            ["hd-street", [tip("GOOD_TO_KNOW", "주말 저녁 7시쯤 버스킹이 많아요")]],
            ["hd-photo", [tip("PHOTO_ZONE", "머리띠·안경 소품은 무료로 빌려줘요", 3)]],
            ["hd-bar", [tip("SIGNATURE_MENU", "유자 하이볼과 닭껍질 꼬치"), tip("CAUTION", "금·토는 2시간 이용 제한")]],
        ],
    },
    {
        title: "익선동 한옥 골목 데이트", sub: "한옥 찻집과 국밥, 골목 산책", region: "종로·익선", grade: "FREE", concept: "감성데이트,맛집탐방", mood: ["레트로", "감성"], target: ["연인", "가족"], budget: "3~6만원", duration: "3시간",
        places: [
            ["ikseon", [tip("WALKING", "골목이 좁아서 오후엔 천천히 걸어야 해요"), tip("PHOTO_ZONE", "한옥 지붕이 겹쳐 보이는 골목 끝이 사진 명소", 3)]],
            ["is-dining", [tip("SIGNATURE_MENU", "맑은 소고기 국밥에 수육 반 접시")]],
            ["is-cafe", [tip("VIBE_CHECK", "마루 좌식이라 편한 바지를 추천해요")]],
        ],
    },
    {
        title: "경복궁 야간 산책 코스", sub: "궁궐 걷고 서촌에서 막걸리", region: "종로·익선", grade: "PREMIUM", concept: "야경,기념일", mood: ["로맨틱", "조용한"], target: ["연인"], budget: "3~6만원", duration: "4시간",
        places: [
            ["gyeongbok", [tip("GOOD_TO_KNOW", "한복을 입으면 입장료가 무료예요", 3), tip("CAUTION", "화요일은 휴궁이에요")]],
            ["bukchon", [tip("CAUTION", "주민 거주지라 저녁 5시 이후엔 조용히 다녀야 해요")]],
            ["jr-bar", [tip("SIGNATURE_MENU", "모둠전과 생막걸리")]],
        ],
    },
    {
        title: "남산타워 야경 코스", sub: "케이블카 대신 걸어서 올라가는 길", region: "용산·한남", grade: "BASIC", concept: "야경,기념일", mood: ["로맨틱"], target: ["연인"], budget: "3~6만원", duration: "4시간",
        places: [
            ["hn-cafe", [tip("SIGNATURE_MENU", "바스크 치즈케이크")]],
            ["namsan", [tip("BEST_SPOT", "해 지기 30분 전에 도착하면 노을과 야경을 다 봐요", 3), tip("ROUTE", "남산 순환버스 01번이 편해요")]],
            ["hn-bar", [tip("VIBE_CHECK", "창밖으로 남산이 보이는 자리를 요청하세요")]],
        ],
    },
    {
        title: "한남동 전시 보고 와인", sub: "미술관 → 향수 공방 → 비스트로", region: "용산·한남", grade: "PREMIUM", concept: "공연·전시,기념일", mood: ["고급스러운", "감성"], target: ["연인"], budget: "10~20만원", duration: "5시간",
        places: [
            ["leeum", [tip("GOOD_TO_KNOW", "상설전은 무료 예약제예요", 3), tip("CAUTION", "월요일은 휴관")]],
            ["hn-perfume", [tip("GOOD_TO_KNOW", "커플 향수 만들기는 1시간, 미리 예약해야 해요")]],
            ["hn-dining", [tip("SIGNATURE_MENU", "오리 콩피와 오늘의 디저트")]],
        ],
    },
    {
        title: "석촌호수 한 바퀴 & 서울스카이", sub: "호수 산책하고 123층에서 야경", region: "잠실", grade: "FREE", concept: "야경,야외", mood: ["로맨틱", "활기찬"], target: ["연인", "가족"], budget: "6~10만원", duration: "4시간",
        places: [
            ["seokchon", [tip("WALKING", "한 바퀴 2.5km, 40분 정도 걸려요")]],
            ["js-cafe", [tip("SIGNATURE_MENU", "딸기 생크림 케이크")]],
            ["skyseoul", [tip("BEST_SPOT", "해 질 녘 입장권이 가장 인기예요", 3)]],
        ],
    },
    {
        title: "잠실 실내 데이트 (비 오는 날)", sub: "보드게임하고 파스타", region: "잠실", grade: "BASIC", concept: "실내데이트,가성비", mood: ["활기찬"], target: ["친구", "썸"], budget: "3~6만원", duration: "3시간",
        places: [
            ["js-activity", [tip("GOOD_TO_KNOW", "직원이 게임 규칙을 설명해 줘요", 3)]],
            ["js-dining", [tip("SIGNATURE_MENU", "명란 크림 생면 파스타")]],
        ],
    },
    {
        title: "여의도 한강 노을 피크닉", sub: "공원 산책 → 한강 노을 → 카페", region: "여의도", grade: "FREE", concept: "야외,힐링", mood: ["감성", "조용한"], target: ["연인", "친구"], budget: "3만원 이하", duration: "3시간",
        places: [
            ["yd-park", [tip("WALKING", "공원 끝에서 끝까지 1.3km예요")]],
            ["hangang-yeouido", [tip("BEST_SPOT", "마포대교 쪽 계단에서 노을이 잘 보여요", 3), tip("GOOD_TO_KNOW", "배달존이 있어서 치킨 주문 가능")]],
            ["yd-cafe", [tip("PHOTO_ZONE", "2층 창가에서 한강이 보여요")]],
        ],
    },
    {
        title: "더현대 서울 실내 데이트", sub: "백화점 정원 구경하고 맛집", region: "여의도", grade: "BASIC", concept: "실내데이트,맛집탐방", mood: ["활기찬"], target: ["연인", "가족"], budget: "6~10만원", duration: "3시간",
        places: [
            ["thehyundai", [tip("GOOD_TO_KNOW", "5층 실내 정원 사운즈 포레스트가 볼거리예요", 3), tip("PARKING", "주말 주차는 오래 기다려요, 지하철 추천")]],
            ["yd-dining", [tip("SIGNATURE_MENU", "제육 백반")]],
        ],
    },
];

const courseIds = [];
let cid = 1;
for (const c of COURSES) {
    const id = cid++;
    courseIds.push(id);
    const [min, max] = (c.budget.match(/\d+/g) || ["3", "6"]).map((n) => Number(n) * 10000);
    await prisma.course.create({
        data: {
            id,
            title: c.title,
            sub_title: c.sub,
            description: `${c.region}에서 ${c.sub}. (체험 데모 예시 코스)`,
            region: c.region,
            duration: c.duration,
            concept: c.concept,
            mood: c.mood,
            target: c.target,
            budget_range: c.budget,
            budget_min: min,
            budget_max: max ?? min,
            grade: c.grade,
            isPublic: true,
            isSelectionType: !!c.selection,
            imageUrl: `/demo/places/${c.places[0][0]}.svg`,
            rating: Math.round((4 + rand()) * 10) / 10,
            view_count: int(80, 900),
            is_editor_pick: id % 4 === 1,
            tags: { concept: c.concept.split(","), mood: c.mood, target: c.target, budget: c.budget },
            createdAt: ago(90 - id * 5),
        },
    });
    await prisma.coursePlace.createMany({
        data: c.places.map(([key, tips, segment, ois], i) => ({
            course_id: id,
            place_id: placeId.get(key),
            order_index: i + 1,
            estimated_duration: pick([40, 60, 90]),
            recommended_time: null,
            segment: segment ?? null,
            order_in_segment: ois ?? null,
            tips: JSON.stringify(tips),
        })),
    });
}

// 가짜 회원 30명 (이름·메일·전화 전부 지어낸 값)
const NICKS = [
    "산책하는고양이", "주말탐험가", "카페인중독", "노을사냥꾼", "한강러버", "골목길여행자", "빵순이", "야경수집가", "느긋한토끼", "성수동주민",
    "데이트장인", "맛집지도", "비오는날", "봄날의곰", "커피한잔", "필름카메라", "걷는게좋아", "오늘도맑음", "작은행복", "여행가방",
    "초록나무", "달빛산책", "보드게임왕", "하이볼한잔", "전시회덕후", "한옥사랑", "피크닉매트", "케이크러버", "자전거타기", "새벽감성",
];
const AGES = ["20대", "20대", "20대", "30대", "30대", "10대", "40대", "50대 이상"];
const UTM = [
    { s: "instagram", c: "fall_course" },
    { s: null, r: "m.search.naver.com" },
    { s: null, r: "www.google.com" },
    { s: null, l: "/share/course/demo" },
    { s: null, l: "/" },
    {},
];
const users = [];
for (let i = 1; i <= 30; i++) {
    const createdDaysAgo = i <= 8 ? int(0, 6) : i <= 16 ? int(7, 29) : int(30, 150);
    const tier = i % 7 === 0 ? "PREMIUM" : i % 3 === 0 ? "BASIC" : "FREE";
    const u = UTM[i % UTM.length];
    const provider = pick(["kakao", "kakao", "apple", "local"]);
    users.push({
        id: i,
        email: `demo.user${String(i).padStart(2, "0")}@example.com`,
        username: NICKS[i - 1],
        provider,
        socialId: provider === "local" ? null : `demo-${provider}-${1000 + i}`,
        gender: i % 2 ? "F" : "M",
        ageRange: AGES[i % AGES.length],
        mbti: pick(["ENFP", "INFP", "ISTJ", "ENTJ", "INFJ", "ESFP", null]),
        createdAt: ago(createdDaysAgo, 20),
        lastActiveAt: ago(int(0, 10), 20),
        subscriptionTier: tier,
        subscriptionExpiresAt: tier === "FREE" ? null : new Date(NOW + int(3, 60) * DAY),
        isMarketingAgreed: i % 4 !== 0,
        marketingAgreedAt: i % 4 !== 0 ? ago(createdDaysAgo) : null,
        hasSeenConsentModal: true,
        signupUtmSource: u.s ?? null,
        signupUtmCampaign: u.c ?? null,
        signupReferrer: u.r ?? null,
        signupLanding: u.l ?? (u.s || u.r ? "/" : null),
        signupSourceAnswer: pick(["instagram", "search", "friend", "share_link", "other", "skipped"]),
        deletedAt: i === 29 || i === 30 ? ago(int(1, 20)) : null,
    });
}
await prisma.user.createMany({ data: users });
const activeUserIds = users.filter((u) => !u.deletedAt).map((u) => u.id);
await prisma.withdrawalLog.createMany({
    data: [
        { userId: 29, reason: "자주 안 쓰게 돼요", createdAt: users[28].deletedAt },
        { userId: 30, reason: "다른 앱을 써요", createdAt: users[29].deletedAt },
    ],
});

// 가짜 푸시 토큰 (Expo 형식이지만 실제 기기 아님)
await prisma.pushToken.createMany({
    data: activeUserIds.slice(0, 22).map((userId) => ({
        userId,
        token: `ExponentPushToken[DEMO-${String(userId).padStart(4, "0")}-NOT-A-DEVICE]`,
        platform: pick(["ios", "android"]),
        subscribed: userId % 5 !== 0,
    })),
});

// 가짜 결제·환불 (토스 결제키 아님)
const PLANS = [
    ["베이직 30일", 4900],
    ["프리미엄 30일", 9900],
    ["코스 열람권 1회", 1900],
];
const payments = [];
for (let i = 1; i <= 16; i++) {
    const [orderName, amount] = PLANS[i % PLANS.length];
    const status = i === 5 ? "CANCELLED" : i === 11 ? "FAILED" : "PAID";
    const at = ago(int(0, 45), 20);
    payments.push({
        id: `demo_pay_${String(i).padStart(2, "0")}`,
        userId: activeUserIds[(i * 3) % activeUserIds.length],
        orderId: `DEMO-ORDER-${String(i).padStart(4, "0")}`,
        orderName,
        amount,
        status,
        paymentKey: status === "FAILED" ? null : `demo_paymentkey_${String(i).padStart(4, "0")}`,
        method: pick(["카드", "간편결제"]),
        requestedAt: at,
        approvedAt: status === "PAID" || status === "CANCELLED" ? at : null,
    });
}
await prisma.payment.createMany({ data: payments });
const refund = (p, status, reason, note) => ({
    paymentId: p.id,
    userId: p.userId,
    orderId: p.orderId,
    orderName: p.orderName,
    amount: p.amount,
    cancelReason: reason,
    status,
    adminNote: note,
    requestedAt: new Date(p.requestedAt.getTime() + DAY),
    processedAt: status === "PENDING" ? null : new Date(p.requestedAt.getTime() + 2 * DAY),
    originalSubscriptionTier: "FREE",
});
await prisma.refundRequest.createMany({
    data: [
        refund(payments[4], "APPROVED", "실수로 두 번 결제했어요", "중복 결제 확인 후 환불"),
        refund(payments[1], "PENDING", "생각보다 코스가 적어요", null),
        refund(payments[7], "PENDING", "결제 후 바로 해지하고 싶어요", null),
    ],
});

// 활동 기록 (대시보드·핵심 숫자용): 최근일수록 많게
const interactions = [];
const weights = courseIds.map((id) => 1 + ((id * 7) % 5));
const weightedCourse = () => {
    let r = rand() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < courseIds.length; i++) if ((r -= weights[i]) < 0) return courseIds[i];
    return courseIds[0];
};
for (let d = 0; d < 30; d++) {
    const n = d < 7 ? int(25, 45) : int(8, 20);
    for (let k = 0; k < n; k++) interactions.push({ userId: pick(activeUserIds), courseId: weightedCourse(), action: "view", createdAt: ago(d, 23) });
    if (rand() < 0.8) interactions.push({ userId: pick(activeUserIds), courseId: weightedCourse(), action: "start", createdAt: ago(d, 23) });
    if (rand() < 0.5) interactions.push({ userId: pick(activeUserIds), courseId: weightedCourse(), action: "save", createdAt: ago(d, 23) });
}
await prisma.userInteraction.createMany({ data: interactions });
await prisma.loginLog.createMany({
    data: Array.from({ length: 160 }, () => ({ userId: pick(activeUserIds), loginAt: ago(int(0, 29), 23), ipAddress: "203.0.113.10" })), // 203.0.113.0/24 = 문서용 예시 대역
});
await prisma.aiRecommendationUsage.createMany({ data: Array.from({ length: 48 }, () => ({ userId: pick(activeUserIds), usedAt: ago(int(0, 29), 23) })) });
await prisma.completedCourse.createMany({ data: Array.from({ length: 22 }, () => ({ userId: pick(activeUserIds), courseId: weightedCourse(), completedAt: ago(int(0, 29), 23) })) });
await prisma.savedCourse.createMany({ data: Array.from({ length: 30 }, () => ({ userId: pick(activeUserIds), courseId: weightedCourse(), savedAt: ago(int(0, 40), 23) })) });
const REVIEWS = ["노을 타이밍 딱 맞췄어요", "동선이 짧아서 좋았어요", "카페가 생각보다 조용했어요", "웨이팅 팁 덕분에 바로 들어갔어요", "다음엔 저녁 코스로 가볼게요"];
await prisma.review.createMany({
    data: Array.from({ length: 16 }, (_, i) => ({
        userId: pick(activeUserIds),
        courseId: weightedCourse(),
        rating: int(4, 5),
        comment: pick(REVIEWS),
        isPublic: i % 3 !== 0, // 비공개 = 추억 기록
        createdAt: ago(int(0, 29), 23),
    })),
});
await prisma.sharedCourse.createMany({
    data: Array.from({ length: 12 }, (_, i) => ({ id: `demo_share_${i + 1}`, templateCourseId: weightedCourse(), sharedByUserId: pick(activeUserIds), createdAt: ago(int(0, 29), 23) })),
});

// 장소 제보 (제보자 = 위 가짜 회원)
const SUGGESTIONS = [
    ["망원 한강공원 피크닉 존", "서울 마포구 망원동 일대", "PENDING", "노을 보면서 피크닉하기 좋아요", "야외"],
    ["성수 LP 바 (예시)", "서울 성동구 성수동 (예시)", "PENDING", "신청곡 틀어주는 LP 바예요", "술자리"],
    ["서촌 독립서점 (예시)", "서울 종로구 서촌 (예시)", "PENDING", "책 고르고 근처 카페 가기 좋아요", "감성데이트"],
    ["을지로 노포 골목", "서울 중구 을지로 일대", "PENDING", "레트로한 분위기의 골목", "맛집탐방"],
    ["잠실 방탈출 카페 (예시)", "서울 송파구 (예시)", "PENDING", "커플 테마가 재밌어요", "이색데이트"],
    ["한남 젤라또 가게 (예시)", "서울 용산구 한남동 (예시)", "ACCEPTED", "피스타치오 젤라또 맛집", "카페투어"],
    ["연남 수제버거 (예시)", "서울 마포구 연남동 (예시)", "ACCEPTED", "패티가 두꺼워요", "맛집탐방"],
    ["석촌호수 벚꽃길", "서울 송파구 잠실동", "PUBLISHED", "봄에 꼭 가야 해요", "야외"],
    ["우리 집 앞 편의점", "서울 어딘가", "REJECTED", "편의점이에요", null],
    ["광고 문의드립니다", null, "REJECTED", "협찬 가능할까요?", null],
];
await prisma.courseSuggestion.createMany({
    data: SUGGESTIONS.map(([placeName, placeAddress, status, description, concept], i) => ({
        userId: activeUserIds[(i * 5 + 2) % activeUserIds.length],
        placeName,
        placeAddress,
        status,
        description,
        concept,
        courseId: status === "PUBLISHED" ? courseIds[8] : null,
        imageUrl: i < 3 ? `/demo/places/${["hangang-yeouido", "ss-bar", "jr-bar"][i]}.svg` : null,
        createdAt: ago(i * 2 + 1, 20),
    })),
});

await prisma.partnerInquiry.createMany({
    data: [
        { brand_name: "예시 브랜드 A", contact_name: "김예시", contact: "partner-a@example.com", inquiry_type: "popup", message: "성수 팝업 소개 가능할까요? (데모 예시)", status: "new", created_at: ago(1, 10) },
        { brand_name: "예시 카페 B", contact_name: "이예시", contact: "010-0000-0000", inquiry_type: "place", message: "저희 카페를 코스에 넣고 싶어요 (데모 예시)", status: "contacted", created_at: ago(5, 10) },
        { brand_name: "예시 광고주 C", contact_name: "박예시", contact: "ads-c@example.com", inquiry_type: "ad", message: "앱 배너 광고 단가 문의 (데모 예시)", status: "done", created_at: ago(12, 10) },
    ],
});

// ---------- 팁 파이프라인 (장소당 평균 26초 · Claude 58원이 나오게 맞춤) ----------
// 텔레그램으로 막 들어온 임시저장 장소
for (const [key, name, category, , address, lat, lng, hours, description, instagram] of TELEGRAM_DRAFTS) {
    placeId.set(key, pid);
    await prisma.place.create({
        data: {
            id: pid++,
            name,
            category,
            address,
            latitude: lat,
            longitude: lng,
            opening_hours: hours,
            description,
            imageUrl: `/demo/places/${key}.svg`,
            status: "draft",
            kakao_place_id: `${900000 + pid}`,
            instagram_handle: instagram,
            created_at: ago(TELEGRAM_DRAFTS.findIndex((t) => t[0] === key), 6),
        },
    });
}

// [장소 key, tip_status, 자료 수(관련), 관련 없음, 사람 검수 분]
const TIP_PLACES = [
    ["seoulforest", "done", 14, 5, 6.5],
    ["ss-cafe", "done", 11, 3, 4.2],
    ["ss-dining", "done", 9, 4, 5.1],
    ["yn-dining", "done", 12, 2, 3.8],
    ["ikseon", "done", 15, 6, 7.4],
    ["gyeongbok", "done", 18, 4, 8.9],
    ["namsan", "done", 16, 5, 6.1],
    ["leeum", "done", 10, 3, 4.6],
    ["skyseoul", "done", 13, 4, 5.5],
    ["hangang-yeouido", "review", 12, 3, null],
    ["hd-photo", "review", 8, 2, null],
    ["js-cafe", "recheck", 4, 6, null],
    ["tg-1", "review", 9, 3, null],
    ["tg-2", "review", 7, 2, null],
    ["tg-3", "collecting", 0, 0, null],
];
const SOURCE_TYPES = ["naver_blog", "naver_blog", "kakao_blog", "google_review", "google_info", "kakao_cafe"];
const CANDIDATE_TEXT = {
    SIGNATURE_MENU: ["대표 메뉴는 블로그 후기에서 가장 많이 언급돼요", "시즌 한정 메뉴가 자주 바뀌어요"],
    WAITING: ["주말 오후 2~4시에 대기가 길어요", "평일 오픈 직후는 바로 들어가요"],
    PARKING: ["주차 공간이 없어 대중교통을 추천해요"],
    CAUTION: ["월요일 휴무인 날이 있어 확인이 필요해요"],
    GOOD_TO_KNOW: ["반려동물 동반이 가능해요", "콘센트 자리가 창가에 있어요"],
};
const runs = [];
let sid = 1;
let tcid = 1;
const candidates = [];
const placeTips = [];
const workLogs = [];
for (const [key, status, relevant, filtered, reviewMin] of TIP_PLACES) {
    const id = placeId.get(key);
    await prisma.place.update({ where: { id }, data: { tip_status: status } });
    if (status === "collecting") continue; // 아직 도는 중: 실행 기록 없음
    const sources = [];
    for (let k = 0; k < relevant + filtered; k++) {
        const type = pick(SOURCE_TYPES);
        sources.push({
            id: sid++,
            place_id: id,
            source_type: type,
            author: type.startsWith("google") ? "Google 사용자" : `블로거${int(10, 99)}`,
            title: `${PLACES.concat(TELEGRAM_DRAFTS).find((p) => p[0] === key)[1].replace(" (예시)", "")} 다녀온 후기 #${k + 1}`,
            content: "예시 자료 본문입니다. 실제 블로그·리뷰 내용이 아니에요.",
            url: `https://blog.example.com/demo/${key}/${k + 1}`,
            written_at: ago(int(3, 400)),
            relevant: k < relevant,
        });
    }
    await prisma.tipSource.createMany({ data: sources });
    const relevantIds = sources.filter((s) => s.relevant).map((s) => s.id);
    // 후보: done이면 결정됨(승인·수정 승인·삭제), review면 검수 대기
    const nCand = Math.min(6, Math.max(3, Math.round(relevant / 2.5)));
    const cats = Object.keys(CANDIDATE_TEXT);
    for (let k = 0; k < nCand; k++) {
        const category = cats[k % cats.length];
        const content = CANDIDATE_TEXT[category][k % CANDIDATE_TEXT[category].length];
        const srcIds = relevantIds.slice(k, k + int(1, 3));
        const decided = status === "done";
        const roll = rand();
        const outcome = !decided ? null : roll < 0.62 ? "asIs" : roll < 0.84 ? "edited" : "rejected";
        const candStatus = !decided ? (k === 0 && relevant > 8 ? "official" : k % 4 === 3 ? "needs_check" : "candidate") : outcome === "rejected" ? "rejected" : "approved";
        const id_ = tcid++;
        candidates.push({
            id: id_,
            place_id: id,
            category,
            content,
            status: candStatus,
            source_ids: srcIds,
            source_count: srcIds.length,
            latest_source_at: ago(int(3, 60)),
            created_at: ago(int(5, 25)),
            decided_at: decided ? ago(int(1, 20)) : null,
        });
        if (outcome === "asIs" || outcome === "edited") {
            placeTips.push({
                place_id: id,
                category,
                content: outcome === "edited" ? `${content} (검수자가 다듬음)` : content,
                candidate_id: id_,
                edited: outcome === "edited",
                approved_at: ago(int(1, 20)),
            });
        }
    }
    if (reviewMin) {
        const opened = ago(int(2, 20), 8);
        workLogs.push({ place_id: id, opened_at: opened, last_approved_at: new Date(opened.getTime() + reviewMin * 60000), approved_count: 3 });
    }
    const started = key.startsWith("tg-") ? ago(TELEGRAM_DRAFTS.findIndex((t) => t[0] === key), 4) : ago(int(3, 25), 20);
    runs.push({
        place_id: id,
        kind: "pipeline",
        started_at: started,
        seconds: 18 + rand() * 16,
        source_count: relevant,
        filtered_count: filtered,
        candidate: candidates.filter((c) => c.place_id === id && c.status === "candidate").length || nCand,
        official: candidates.filter((c) => c.place_id === id && c.status === "official").length,
        needs_check: candidates.filter((c) => c.place_id === id && c.status === "needs_check").length,
        input_tokens: int(6500, 9500),
        output_tokens: int(900, 1500),
        google_calls: key.startsWith("tg-") || rand() < 0.8 ? 2 : 0,
        error: status === "recheck" ? "Error: 예시 실패 — 관련 자료가 너무 적어요" : null,
    });
}
// 직접 추가한 팁 1개 (후보 없이 승인)
placeTips.push({ place_id: placeId.get("gyeongbok"), category: "ATTIRE", content: "궁궐 안은 많이 걸어서 편한 신발이 좋아요", candidate_id: null, edited: false, approved_at: ago(3) });

// 평균 자동 처리 시간 26초, 장소당 Claude 비용 58원에 맞추기 (src/app/api/admin/tips/stats/route.ts 계산식 그대로)
const ok = runs.filter((r) => !r.error);
const shift = 26 - ok.reduce((a, r) => a + r.seconds, 0) / ok.length;
for (const r of ok) r.seconds += shift;
for (const r of runs) if (r.error) Object.assign(r, { input_tokens: 0, output_tokens: 0 });
const placesProcessed = new Set(runs.map((r) => r.place_id)).size;
const units = (r) => r.input_tokens * 3 + r.output_tokens * 15; // claudeUsd × 1e6
const targetUnits = ((58 * placesProcessed) / 1400) * 1e6;
const scale = targetUnits / runs.reduce((a, r) => a + units(r), 0);
for (const r of ok) Object.assign(r, { input_tokens: Math.round(r.input_tokens * scale), output_tokens: Math.round(r.output_tokens * scale) });
ok[0].input_tokens += Math.round((targetUnits - runs.reduce((a, r) => a + units(r), 0)) / 3);

await prisma.tipCandidate.createMany({ data: candidates });
await prisma.placeTip.createMany({ data: placeTips });
await prisma.tipWorkLog.createMany({ data: workLogs });
await prisma.tipRun.createMany({
    data: runs.map(({ seconds, ...r }) => ({ ...r, finished_at: r.error ? null : new Date(r.started_at.getTime() + seconds * 1000) })),
});

// 명시한 id 다음부터 자동 번호가 이어지게
for (const t of ["places", "courses", "users", "tip_sources", "tip_candidates"]) {
    await q(`SELECT setval(pg_get_serial_sequence('"${t}"', 'id'), (SELECT MAX(id) FROM "${t}"))`);
}

// ---------- 5. (선택) 읽기 전용 역할 ----------
const readerPassword = process.env.DEMO_READER_PASSWORD;
if (readerPassword) {
    if (readerPassword.length < 16) fail("DEMO_READER_PASSWORD 는 16자 이상으로 해 주세요.");
    const lit = (s) => `'${s.replace(/'/g, "''")}'`;
    const [{ db }] = await q(`SELECT current_database() AS db`);
    const [{ exists }] = await q(`SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dona_demo_reader') AS exists`);
    await q(`${exists ? "ALTER" : "CREATE"} ROLE dona_demo_reader LOGIN PASSWORD ${lit(readerPassword)}`);
    await q(`ALTER ROLE dona_demo_reader SET default_transaction_read_only = on`);
    await q(`GRANT CONNECT ON DATABASE "${db.replace(/"/g, '""')}" TO dona_demo_reader`);
    await q(`GRANT USAGE ON SCHEMA public, dona_demo TO dona_demo_reader`);
    await q(`GRANT SELECT ON ALL TABLES IN SCHEMA public, dona_demo TO dona_demo_reader`);
    const readerUrl = new URL(url);
    readerUrl.username = "dona_demo_reader";
    readerUrl.password = "PASSWORD";
    console.log(`\n✓ 읽기 전용 역할 dona_demo_reader 준비 완료. Vercel DEMO_DATABASE_URL 형식 (PASSWORD 자리에 DEMO_READER_PASSWORD):\n   ${readerUrl.toString()}`);
}

await prisma.$disconnect();
await client.end();

const won = runs.reduce((a, r) => a + ((r.input_tokens * 3 + r.output_tokens * 15) / 1e6) * 1400, 0);
console.log(`
✅ 데모 데이터 완료
   지역 ${REGIONS.length} · 장소 ${pid - 1} (임시저장 ${TELEGRAM_DRAFTS.length}) · 코스 ${COURSES.length} · 가짜 회원 ${users.length} · 결제 ${payments.length} · 제보 ${SUGGESTIONS.length}
   팁 파이프라인: 처리 장소 ${placesProcessed}곳, 평균 ${(ok.reduce((a, r) => a + r.seconds, 0) / ok.length).toFixed(1)}초, 장소당 Claude ${Math.round(won / placesProcessed)}원
`);
