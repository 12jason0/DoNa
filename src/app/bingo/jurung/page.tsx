"use client";

// src/app/bingo/jurung/page.tsx
// 💌 크림톤 스크랩북 다이어리 감성 "오늘의 주렁주렁" (모바일 3x3 데이트 미션 빙고)
//  - 폴라로이드 + 마스킹테이프, 살짝 기울인 3x3 그리드
//  - 칸 탭 → 내 사진(인증샷) 업로드. 사진을 올린 칸이 곧 '완료'(초록 ✓). 다시 탭하면 교체
//  - 별도의 완료 스탬프 / ✕ 지우기 / 📷 버튼 없음 (칸 전체가 업로드 버튼)
//  - 가로/세로/대각선 한 줄 완성될 때마다 폭죽 + 축하 배너
//  - 한 줄 이상 완성되면 "사진으로 저장"(빙고판 PNG 다운로드) 활성
//  - 폰트: 프로젝트 감성 합성 패밀리 RoundDisplay(라틴 Kalam · 한글 Cafe24Dongdong)
//  - 저장은 html2canvas 없이 수동 canvas 렌더
//
// 📌 일러스트 교체: public/bingo/jurung/ 에 정사각 이미지 illust-{key}.png
//    (illust-otter/prairiedog/cafe/fish/lunch/meeacat/turtle/penguin/capybara.png)를 넣으면 라인아트 대신 그 그림이 뜬다.
//    파일이 없으면(404) 자동으로 굵은 선 라인아트로 폴백된다.

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

// ── 색/폰트 토큰 ──
const C = {
    bg: "#EFE2C9", // 크래프트지 배경
    board: "#E9D9BE", // 빙고 판
    border: "#DCC7A4", // 판 테두리/줄무늬
    polaroid: "#FFFDF8", // 폴라로이드
    brown: "#5A4636", // 다크브라운(제목·버튼·글씨)
    caption: "#8C7A66", // 미션 캡션 — 사진 밑 한 줄, 연한 갈색으로 물러나게
    textLight: "#F3E7D0", // 버튼 위 밝은 글씨
    coral: "#C4553A",
    ring: "#E8895C", // 완성 줄 하이라이트 링
    green: "#3FA97A",
    photoFilter: "sepia(12%) saturate(90%)", // 조명 제각각인 폰 사진들을 한 판처럼 묶어주는 톤 통일
    tapeCoral: "rgba(232,137,92,.55)",
    tapeMint: "rgba(127,184,160,.60)",
    photoBg: "#F1E7D4",
};
const FONT = `"RoundDisplay", "Cafe24Dongdong", system-ui, sans-serif`;

// ── 미션 9개 (순서 고정) ──
type Mission = { label: string; key: string | null };
const MISSIONS: Mission[] = [
    { label: "수달과 투샷 찍기", key: "otter" },
    { label: "프레디독이랑 눈 맞추기", key: "prairiedog" },
    { label: "카페에서 당 충전하기", key: "cafe" },
    { label: "닥터피쉬 5초 버티기", key: "fish" },
    { label: "빙고판 완성!", key: "donalogo" },
    { label: "자라 찾아서 인증샷", key: "turtle" },
    { label: "펭귄 멍하니 보기", key: "penguin" },
    { label: "카피바라랑 셀카", key: "capybara" },
    { label: "미어캣 밥 주기", key: "meeacat" },
];

// 한가운데(4번)는 처음부터 완료돼 있는 FREE 칸 — 완료된 미션으로 세어 시작부터 1/9
const AUTO_INDEX = 4;

// 아직 사진을 안 올린 칸의 일러스트는 연하게 — "채워야 할 칸"으로 읽히게
// (너무 연하면 얼룩처럼 보여 뭘 찍어야 할지 안 읽힌다 → 살짝 진하게)
const ILLUST_ALPHA = 0.45;

// 빙고 판정 (가로3 · 세로3 · 대각2)
const LINES = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
];

// 스크랩북 느낌의 미세한 개별 기울기(고정값)
const ROT = [-1.6, 1.3, -1.0, 1.5, -0.7, 1.1, -1.4, 0.9, -1.2];

// ── 굵은 선 라인아트 폴백 ──
const la = (inner: string) =>
    `data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="${C.brown}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`,
    )}`;
const dot = (x: number, y: number, r = 2.6) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.brown}" stroke="none"/>`;

const LINEART: string[] = [
    // 0 수달
    la(
        `<ellipse cx="50" cy="58" rx="26" ry="18"/><circle cx="50" cy="36" r="14"/><circle cx="41" cy="26" r="4.5"/><circle cx="59" cy="26" r="4.5"/>${dot(44, 35)}${dot(56, 35)}<path d="M50 39 v3"/><path d="M46 44 q4 3 8 0"/><path d="M28 60 q-8 3 -7 11 M72 60 q8 3 7 11"/>`,
    ),
    // 1 프레디독(프레리도그)
    la(
        `<path d="M50 42 C38 46 38 74 44 84 L56 84 C62 74 62 46 50 42 Z"/><circle cx="50" cy="31" r="13"/><circle cx="42" cy="21" r="3.8"/><circle cx="58" cy="21" r="3.8"/>${dot(45, 30)}${dot(55, 30)}<path d="M50 33 v4"/><path d="M46 56 q-6 4 -4 12 M54 56 q6 4 4 12"/>`,
    ),
    // 2 카페
    la(
        `<path d="M28 44 H64 V55 a18 18 0 0 1 -36 0 Z"/><path d="M64 47 a10 10 0 0 1 0 16"/><path d="M24 76 H70"/><path d="M40 34 q5 -5 0 -11 M52 34 q5 -5 0 -11"/>`,
    ),
    // 3 닥터피쉬
    la(
        `<ellipse cx="45" cy="52" rx="26" ry="16"/><path d="M71 52 L88 39 V65 Z"/>${dot(33, 47, 3)}<path d="M40 60 q6 4 12 0"/>`,
    ),
    // 4 빙고판 완성!(트로피 + 하트)
    la(
        `<path d="M34 26 H66 V42 a16 16 0 0 1 -32 0 Z"/><path d="M34 30 H23 a8 8 0 0 0 8 12 M66 30 H77 a8 8 0 0 1 -8 12"/><path d="M50 58 V69 M39 69 H61 M35 81 H65 L60 69 H40 Z"/><path d="M50 33 q-3.5 -5 -8 -1 q-3 3.5 8 10.5 q11 -7 8 -10.5 q-4.5 -4 -8 1 Z"/>`,
    ),
    // 5 자라
    la(
        `<path d="M26 60 a24 16 0 0 1 48 0"/><path d="M26 60 H74"/><circle cx="82" cy="57" r="6"/><path d="M74 60 h3"/><path d="M50 44 V60 M37 51 L50 60 L63 51"/><path d="M32 60 v10 M45 61 v9 M55 61 v9 M68 60 v9"/>`,
    ),
    // 6 팽귄
    la(
        `<path d="M50 22 C34 22 33 52 35 68 C37 83 44 87 50 87 C56 87 63 83 65 68 C67 52 66 22 50 22 Z"/><path d="M50 34 C43 34 41 62 45 78 M50 34 C57 34 59 62 55 78"/>${dot(44, 37)}${dot(56, 37)}<path d="M46 43 L50 48 L54 43 Z" fill="${C.brown}" stroke="none"/><path d="M43 87 l-6 5 M57 87 l6 5"/>`,
    ),
    // 7 카피바라
    la(
        `<ellipse cx="50" cy="58" rx="30" ry="19"/><ellipse cx="50" cy="41" rx="18" ry="15"/><circle cx="40" cy="28" r="4.5"/><circle cx="60" cy="28" r="4.5"/>${dot(43, 40)}${dot(57, 40)}<path d="M44 48 q6 4 12 0"/><path d="M33 70 v8 M44 72 v8 M56 72 v8 M67 70 v8"/>`,
    ),
    // 8 미어캣 밥주기(밥그릇 + 하트)
    la(
        `<path d="M26 54 H74 a24 22 0 0 1 -48 0 Z"/><path d="M22 54 H78"/><path d="M39 54 q4 -13 11 -13 q7 0 11 13"/><path d="M50 30 q-4 -6 -9 -1.5 q-3.5 4 9 12 q12.5 -8 9 -12 q-5 -4.5 -9 1.5 Z"/>`,
    ),
];

// 칸 완료 = 내 사진을 올렸는지 여부(photo)로만 판정
type CellState = { photo: string | null };
const emptyBoard = (): CellState[] => Array.from({ length: 9 }, () => ({ photo: null }));

// 같은 기기(브라우저)에 진행 상태를 저장하는 키
// v2: { savedAt: number, board: CellState[] } 형태로 저장(마지막 활동 시각 포함)
const STORAGE_KEY = "dona-bingo-jurung-v2";
const OLD_STORAGE_KEY = "dona-bingo-jurung-v1"; // 타임스탬프 없던 예전 저장본(정리용)
// 마지막 사진 업로드 후 이 시간이 지나면 자동 초기화(로그인 없는 공유 링크용)
const TTL_MS = 12 * 60 * 60 * 1000; // 12시간

export default function JurungBingoPage() {
    const [board, setBoard] = useState<CellState[]>(emptyBoard);
    const [pngOk, setPngOk] = useState<Record<number, boolean>>({}); // 실제 일러스트 png 로드 성공 시에만 사용
    const [banner, setBanner] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const pickingIndex = useRef<number | null>(null);
    const confettiRef = useRef<HTMLCanvasElement>(null);
    const boardRef = useRef<HTMLDivElement>(null);
    const prevLines = useRef(0);
    const bannerTimer = useRef<number | undefined>(undefined);
    const rafRef = useRef<number | undefined>(undefined);
    const firstSave = useRef(true); // 첫 렌더에서 빈 보드로 저장소를 덮어쓰지 않도록
    const skipNextSave = useRef(false); // 복원으로 인한 setBoard는 저장(=활동시각 갱신)에서 제외

    // 한가운데(4번)는 미션이 아니라 처음부터 완성된 FREE 칸 — 항상 done으로 친다
    const isDone = useCallback((i: number) => i === AUTO_INDEX || Boolean(board[i].photo), [board]);

    const completedLines = useMemo(() => LINES.filter((l) => l.every((i) => isDone(i))).length, [isDone]);
    // 가운데 FREE 칸도 '완료된 미션'으로 세어 시작부터 1/9로 보이게 한다
    const doneCount = useMemo(() => MISSIONS.reduce((n, _m, i) => n + (isDone(i) ? 1 : 0), 0), [isDone]);

    const canSave = completedLines >= 1;

    // 각 칸에 실제로 보여줄 이미지 소스
    const illustSrc = useCallback(
        (i: number) => {
            const key = MISSIONS[i].key;
            if (key && pngOk[i]) return `/bingo/jurung/illust-${key}.png`;
            return LINEART[i];
        },
        [pngOk],
    );

    // 실제 일러스트 파일이 있으면(로드 성공) 라인아트 대신 사용.
    // SSR 시 img가 404로 먼저 깨지는 것을 막기 위해, 클라이언트에서 미리 로드해보고 성공할 때만 교체한다.
    useEffect(() => {
        MISSIONS.forEach((m, i) => {
            if (!m.key) return;
            const im = new Image();
            im.onload = () => setPngOk((p) => ({ ...p, [i]: true }));
            im.src = `/bingo/jurung/illust-${m.key}.png`;
        });
    }, []);

    // ── 같은 기기(브라우저)에 진행 상태 저장/복원 ──
    // 마운트 후 클라이언트에서만 읽어 SSR 불일치를 피한다.
    useEffect(() => {
        try {
            localStorage.removeItem(OLD_STORAGE_KEY); // 예전 저장본은 더 이상 쓰지 않으므로 정리
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const saved = JSON.parse(raw);
                const fresh = saved && typeof saved.savedAt === "number" && Date.now() - saved.savedAt < TTL_MS;
                if (fresh && Array.isArray(saved.board) && saved.board.length === 9) {
                    // 12시간 이내 → 복원(이 setBoard는 활동시각 갱신에서 제외)
                    skipNextSave.current = true;
                    setBoard(
                        saved.board.map((c: CellState, i: number) => ({
                            // 자동 완료 칸에는 예전 저장본의 사진이 남아 있어도 쓰지 않는다
                            photo: i !== AUTO_INDEX && typeof c?.photo === "string" ? c.photo : null,
                        })),
                    );
                } else {
                    // 12시간 초과(또는 손상된 데이터) → 자동 초기화
                    localStorage.removeItem(STORAGE_KEY);
                }
            }
        } catch {
            /* 시크릿모드 등 저장소 접근 불가 시 무시 */
        }
    }, []);

    // 보드가 바뀔 때마다 저장(첫 렌더는 건너뛰어 빈 보드로 덮어쓰지 않게)
    useEffect(() => {
        if (firstSave.current) {
            firstSave.current = false;
            return;
        }
        if (skipNextSave.current) {
            // 저장소 복원으로 인한 setBoard → 활동시각(savedAt)을 갱신하지 않는다
            skipNextSave.current = false;
            return;
        }
        try {
            // 사진 업로드 등 실제 활동 시점 → savedAt을 지금으로 갱신(마지막 활동 후 12시간 기준)
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), board }));
        } catch {
            /* 용량 초과 등은 무시 */
        }
    }, [board]);

    // ── 폭죽 ──
    const celebrate = useCallback((lines: number) => {
        const msg =
            lines >= 8 ? "올빙고 완성! 완벽한 데이트 🏆" : lines === 1 ? "빙고! 첫 줄 완성 🎉" : `${lines}줄 완성! 🎉`;
        setBanner(msg);
        window.clearTimeout(bannerTimer.current);
        bannerTimer.current = window.setTimeout(() => setBanner(null), 2000);

        const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        const cv = confettiRef.current;
        if (reduce || !cv) return;
        const ctx = cv.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const w = window.innerWidth;
        const h = window.innerHeight;
        cv.width = w * dpr;
        cv.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const colors = [C.coral, C.green, "#E8895C", "#7FB8A0", "#EBCB8B", C.brown];
        const parts = Array.from({ length: 130 }, () => {
            const ang = Math.random() * Math.PI * 2;
            const sp = 4 + Math.random() * 9;
            return {
                x: w / 2,
                y: h * 0.32,
                vx: Math.cos(ang) * sp,
                vy: Math.sin(ang) * sp - 6,
                rot: Math.random() * Math.PI,
                vr: (Math.random() - 0.5) * 0.4,
                sz: 6 + Math.random() * 7,
                color: colors[(Math.random() * colors.length) | 0],
                life: 0,
            };
        });

        const start = performance.now();
        const tick = (now: number) => {
            const t = now - start;
            ctx.clearRect(0, 0, w, h);
            for (const p of parts) {
                p.vy += 0.28; // 중력
                p.x += p.vx;
                p.y += p.vy;
                p.rot += p.vr;
                p.life = t;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.globalAlpha = Math.max(0, 1 - t / 1500);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.sz / 2, -p.sz / 2, p.sz, p.sz * 0.6);
                ctx.restore();
            }
            if (t < 1500) {
                rafRef.current = requestAnimationFrame(tick);
            } else {
                ctx.clearRect(0, 0, w, h);
            }
        };
        cancelAnimationFrame(rafRef.current!);
        rafRef.current = requestAnimationFrame(tick);
    }, []);

    // 완성 줄 수가 '증가'하는 순간에만 축하
    useEffect(() => {
        if (completedLines > prevLines.current) celebrate(completedLines);
        prevLines.current = completedLines;
    }, [completedLines, celebrate]);

    useEffect(() => {
        return () => {
            window.clearTimeout(bannerTimer.current);
            cancelAnimationFrame(rafRef.current!);
        };
    }, []);

    // ── 인터랙션 ── 칸을 탭하면 내 사진을 올린다(이미 있으면 교체)
    const pick = (i: number) => {
        if (i === AUTO_INDEX) return; // '빙고판 완성!' 칸은 자동 완료 — 업로드하지 않는다
        pickingIndex.current = i;
        fileInputRef.current?.click();
    };

    const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        const i = pickingIndex.current;
        e.target.value = "";
        if (!file || i == null) return;
        // 저장소 용량을 위해 최대 900px로 축소 후 JPEG로 인코딩해서 보관
        const objUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const MAX = 900;
            const scale = Math.min(1, MAX / Math.max(img.width, img.height));
            const w = Math.max(1, Math.round(img.width * scale));
            const h = Math.max(1, Math.round(img.height * scale));
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
            const url = canvas.toDataURL("image/jpeg", 0.82);
            URL.revokeObjectURL(objUrl);
            setBoard((b) => b.map((c, k) => (k === i ? { photo: url } : c)));
        };
        img.onerror = () => URL.revokeObjectURL(objUrl);
        img.src = objUrl;
    };

    // ── 수동 canvas 저장 (1080 x auto PNG) ──
    const handleSave = useCallback(async () => {
        if (!canSave) return;
        setSaving(true);
        try {
            await (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready;

            const loadImg = (src: string) =>
                new Promise<HTMLImageElement | null>((res) => {
                    const im = new Image();
                    im.onload = () => res(im);
                    im.onerror = () => res(null);
                    im.src = src;
                });

            // 각 칸 이미지 준비(사진 > png > 라인아트)
            const cellImgs = await Promise.all(
                board.map(async (c, i) => {
                    if (c.photo) return await loadImg(c.photo);
                    const key = MISSIONS[i].key;
                    if (key && pngOk[i]) {
                        const png = await loadImg(`/bingo/jurung/illust-${key}.png`);
                        if (png) return png;
                    }
                    return await loadImg(LINEART[i]);
                }),
            );

            const W = 1080;
            const PAD = 54;
            const cardX = PAD;
            const cardW = W - PAD * 2; // 972
            const cardPad = 40;
            const gap = 26;
            const cellW = (cardW - cardPad * 2 - gap * 2) / 3; // ≈ 280
            const photoSz = cellW; // 사진이 칸 폭을 꽉 채운다
            const capH = 44;
            const polH = photoSz + capH;
            const titleTop = 96;
            const gridTop = 300;
            const cardH = cardPad * 2 + polH * 3 + gap * 2;
            const H = gridTop + cardH + 130;

            const canvas = document.createElement("canvas");
            canvas.width = W;
            canvas.height = H;
            const ctx = canvas.getContext("2d")!;
            const D = Math.PI / 180;

            const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
                ctx.beginPath();
                ctx.roundRect(x, y, w, h, r);
            };
            const drawCover = (im: HTMLImageElement, dx: number, dy: number, dw: number, dh: number) => {
                const s = Math.max(dw / im.width, dh / im.height);
                const iw = im.width * s;
                const ih = im.height * s;
                ctx.drawImage(im, dx + (dw - iw) / 2, dy + (dh - ih) / 2, iw, ih);
            };
            const drawContain = (im: HTMLImageElement, dx: number, dy: number, dw: number, dh: number) => {
                const s = Math.min((dw * 0.82) / im.width, (dh * 0.82) / im.height);
                const iw = im.width * s;
                const ih = im.height * s;
                ctx.drawImage(im, dx + (dw - iw) / 2, dy + (dh - ih) / 2, iw, ih);
            };

            // 배경 크래프트 + radial
            const bg = ctx.createLinearGradient(0, 0, 0, H);
            bg.addColorStop(0, "#F3E7CE");
            bg.addColorStop(1, C.bg);
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, W, H);
            const rg = ctx.createRadialGradient(W / 2, gridTop + cardH / 2, 100, W / 2, gridTop + cardH / 2, W);
            rg.addColorStop(0, "rgba(255,250,235,0.55)");
            rg.addColorStop(1, "rgba(255,250,235,0)");
            ctx.fillStyle = rg;
            ctx.fillRect(0, 0, W, H);

            // 제목 (텍스트만)
            ctx.fillStyle = C.brown;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = `800 76px ${FONT}`;
            ctx.fillText("오늘의 주렁주렁", W / 2, titleTop + 56);
            ctx.globalAlpha = 0.7;
            ctx.font = `400 30px ${FONT}`;
            ctx.fillText("한 칸씩 채우는 우리의 하루", W / 2, titleTop + 150);
            ctx.globalAlpha = 1;

            // 빙고 판 카드 + 세로 줄무늬
            ctx.save();
            roundRect(cardX, gridTop, cardW, cardH, 28);
            ctx.fillStyle = C.board;
            ctx.shadowColor = "rgba(90,70,54,0.22)";
            ctx.shadowBlur = 26;
            ctx.shadowOffsetY = 12;
            ctx.fill();
            ctx.shadowColor = "transparent";
            roundRect(cardX, gridTop, cardW, cardH, 28);
            ctx.clip();
            ctx.strokeStyle = "rgba(220,199,164,0.55)";
            ctx.lineWidth = 10;
            for (let sx = cardX + 14; sx < cardX + cardW; sx += 30) {
                ctx.beginPath();
                ctx.moveTo(sx, gridTop);
                ctx.lineTo(sx, gridTop + cardH);
                ctx.stroke();
            }
            ctx.restore();
            roundRect(cardX, gridTop, cardW, cardH, 28);
            ctx.strokeStyle = C.border;
            ctx.lineWidth = 3;
            ctx.stroke();

            // 폴라로이드 9칸
            for (let i = 0; i < 9; i++) {
                const col = i % 3;
                const row = (i / 3) | 0;
                const x = cardX + cardPad + col * (cellW + gap);
                const y = gridTop + cardPad + row * (polH + gap);
                const c = board[i];
                const im = cellImgs[i];

                ctx.save();
                ctx.translate(x + cellW / 2, y + polH / 2);
                ctx.rotate((ROT[i] - 0.6) * D);
                const ox = -cellW / 2;
                const oy = -polH / 2;

                // 폴라로이드 배경
                roundRect(ox, oy, cellW, polH, 10);
                ctx.fillStyle = C.polaroid;
                ctx.shadowColor = "rgba(90,70,54,0.20)";
                ctx.shadowBlur = 14;
                ctx.shadowOffsetY = 6;
                ctx.fill();
                ctx.shadowColor = "transparent";

                // 사진 영역 — 폴라로이드 폭을 꽉 채운다
                const px = ox;
                const py = oy;
                ctx.save();
                roundRect(px, py, photoSz, photoSz, 10);
                ctx.clip();
                ctx.fillStyle = C.photoBg;
                ctx.fillRect(px, py, photoSz, photoSz);
                if (im) {
                    // 내 사진과 한가운데 두나 로고는 원본 농도, 나머지 안 채운 칸의 일러스트는 연하게
                    ctx.globalAlpha = c.photo || i === AUTO_INDEX ? 1 : ILLUST_ALPHA;
                    // 올린 사진만 톤 통일 필터 — 일러스트는 그대로
                    if (c.photo) ctx.filter = C.photoFilter;
                    if (c.photo || (MISSIONS[i].key && pngOk[i])) drawCover(im, px, py, photoSz, photoSz);
                    else drawContain(im, px, py, photoSz, photoSz);
                    ctx.filter = "none";
                    ctx.globalAlpha = 1;
                }
                ctx.restore();

                // 마스킹테이프 (짝수 코랄 / 홀수 민트, 반대로 기울임)
                ctx.save();
                ctx.translate(ox + cellW / 2, oy + 4);
                ctx.rotate((i % 2 === 0 ? -8 : 8) * D);
                ctx.fillStyle = i % 2 === 0 ? C.tapeCoral : C.tapeMint;
                ctx.fillRect(-34, -12, 68, 24);
                ctx.restore();

                // 캡션 — 사진 밑 한 줄(칸을 넘치면 폭에 맞춰 줄인다)
                if (i !== AUTO_INDEX) {
                    const label = MISSIONS[i].label;
                    ctx.fillStyle = C.caption;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    let size = 24;
                    ctx.font = `600 ${size}px ${FONT}`;
                    while (size > 16 && ctx.measureText(label).width > cellW - 16) {
                        size -= 1;
                        ctx.font = `600 ${size}px ${FONT}`;
                    }
                    ctx.fillText(label, ox + cellW / 2, oy + photoSz + capH / 2);
                }
                ctx.restore();
            }

            // 푸터 — 가운데 로고가 워터마크 역할을 하므로 "두나" 서명은 넣지 않는다
            ctx.fillStyle = C.brown;
            ctx.textAlign = "center";
            ctx.font = `700 34px ${FONT}`;
            ctx.fillText(
                completedLines >= 1 ? `빙고 ${completedLines}줄 · 미션 ${doneCount}/9` : `미션 ${doneCount}/9`,
                W / 2,
                gridTop + cardH + 70,
            );

            const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b as Blob), "image/png", 0.95));
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "데이트빙고.png";
            a.click();
            URL.revokeObjectURL(url);
        } finally {
            setSaving(false);
        }
    }, [board, pngOk, canSave, completedLines, doneCount]);

    return (
        <div
            className="flex h-[100dvh] w-full flex-col overflow-hidden"
            style={{
                background: `radial-gradient(120% 80% at 50% 30%, rgba(255,250,235,0.6), transparent 70%), ${C.bg}`,
                color: C.brown,
                fontFamily: FONT,
            }}
        >
            {/* 폭죽 오버레이 */}
            <canvas
                ref={confettiRef}
                className="pointer-events-none fixed inset-0 z-50"
                style={{ width: "100%", height: "100%" }}
                aria-hidden
            />

            {/* 축하 배너 */}
            {banner && (
                <div
                    className="fixed left-1/2 top-1/2 z-[60] whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold shadow-lg"
                    style={{
                        background: C.brown,
                        color: C.textLight,
                        transform: "translate(-50%,-50%) rotate(-1.5deg)",
                    }}
                    role="status"
                >
                    {banner}
                </div>
            )}

            <div className="mx-auto flex h-full w-full max-w-[520px] flex-col px-1.5 pb-6 pt-8">
                {/* 제목 */}
                <div className="mb-4 flex flex-col items-center">
                    <span className="text-2xl font-extrabold" style={{ color: C.brown }}>
                        오늘의 주렁주렁
                    </span>
                    <span className="mt-1.5 text-xs" style={{ color: C.brown, opacity: 0.7 }}>
                        한 칸씩 채우는 우리의 하루
                    </span>
                </div>

                {/* 빙고 판 영역 — 남는 공간에 중앙 배치(스크롤 없이 한 화면) */}
                <div className="flex min-h-0 flex-1 items-center justify-center">
                    {/* 세로 줄무늬 크래프트 카드 — 화면 높이에 맞춰 폭 제한 */}
                    <div
                        ref={boardRef}
                        className="rounded-2xl p-1.5"
                        style={{
                            width: "min(100%, calc((100dvh - 212px) * 0.78))",
                            maxHeight: "100%",
                            background: `repeating-linear-gradient(90deg, ${C.board} 0 14px, rgba(220,199,164,0.35) 14px 16px)`,
                            border: `2px solid ${C.border}`,
                            boxShadow: "0 10px 26px rgba(90,70,54,0.20)",
                        }}
                    >
                        {/* 3x3 그리드 (-0.6° 기울임) */}
                        <div className="grid grid-cols-3 gap-2" style={{ transform: "rotate(-0.6deg)" }}>
                            {MISSIONS.map((m, i) => {
                                const c = board[i];
                                const even = i % 2 === 0;
                                const auto = i === AUTO_INDEX; // 미션 아님 — 처음부터 완성된 FREE 칸
                                const done = isDone(i);
                                return (
                                    <div key={i} className="relative" style={{ transform: `rotate(${ROT[i]}deg)` }}>
                                        {/* 폴라로이드 — 칸을 탭하면 내 사진 업로드(있으면 교체).
                                            · 안 올린 칸: 예전처럼 일러스트(정사각) + 아래 캡션 띠
                                            · 올린 칸 / FREE 로고: 사진이 캡션 자리까지 칸 전체를 채우고 텍스트는 그 위에 겹침 */}
                                        <button
                                            type="button"
                                            aria-label={
                                                auto
                                                    ? "FREE 칸 · 처음부터 완성돼 있어요"
                                                    : c.photo
                                                      ? `${m.label} 사진 바꾸기`
                                                      : `${m.label} 인증샷 올리기`
                                            }
                                            onClick={() => pick(i)}
                                            className={`relative block w-full overflow-hidden rounded-md text-left transition ${auto ? "cursor-default" : "cursor-pointer active:scale-[0.98]"}`}
                                            style={{
                                                background: C.polaroid,
                                                boxShadow: "0 3px 8px rgba(90,70,54,0.18)",
                                            }}
                                        >
                                            {/* 사진 영역(정사각) — 칸 높이를 정한다 */}
                                            <div
                                                className="relative overflow-hidden"
                                                style={{ aspectRatio: "1 / 1", background: C.photoBg }}
                                            >
                                                {/* 안 채운 미션 칸의 일러스트(연하게) */}
                                                {!c.photo && !auto && (
                                                    <img
                                                        src={illustSrc(i)}
                                                        alt=""
                                                        className="absolute inset-0 h-full w-full"
                                                        style={{
                                                            objectFit: m.key && pngOk[i] ? "cover" : "contain",
                                                            padding: m.key && pngOk[i] ? 0 : "14%",
                                                            opacity: ILLUST_ALPHA,
                                                        }}
                                                    />
                                                )}
                                                {/* 아직 안 채운 칸 → 업로드 슬롯임을 명확히 (점선 테두리 + 가운데 "＋ 사진") */}
                                                {!c.photo && !auto && (
                                                    <>
                                                        <span
                                                            className="pointer-events-none absolute inset-1 rounded-md"
                                                            style={{ border: "2px dashed rgba(90,70,54,0.30)" }}
                                                        />
                                                        <span
                                                            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                                                            style={{ background: "rgba(90,70,54,0.62)", color: C.textLight }}
                                                        >
                                                            ＋ 사진
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                            {/* 캡션 띠 — 안 올린 칸은 예전처럼 사진 밑 한 줄(길면 2줄) */}
                                            <div
                                                className="flex items-center justify-center overflow-hidden px-1 pb-1 pt-1 text-center leading-tight"
                                                style={{ minHeight: 30, fontSize: 12, color: C.caption }}
                                            >
                                                <span className="line-clamp-2">{auto ? "" : m.label}</span>
                                            </div>

                                            {/* 사진 올린 칸(또는 FREE 로고)은 칸 전체를 꽉 채워 캡션 띠까지 덮는다 */}
                                            {(c.photo || auto) && (
                                                <img
                                                    src={c.photo ?? illustSrc(i)}
                                                    alt=""
                                                    className="absolute inset-0 h-full w-full"
                                                    style={{
                                                        objectFit: "cover",
                                                        // 올린 사진만 톤 통일 필터 — FREE 로고는 그대로
                                                        filter: c.photo ? C.photoFilter : undefined,
                                                    }}
                                                />
                                            )}
                                            {/* 올린 사진 위 캡션 — 하단 그라데이션 + 밝은 글씨로 사진 위에서도 읽히게 */}
                                            {c.photo && (
                                                <span
                                                    className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-center px-1 pb-1 pt-5 text-center font-semibold leading-tight"
                                                    style={{
                                                        fontSize: 12,
                                                        color: C.polaroid,
                                                        background:
                                                            "linear-gradient(to top, rgba(40,28,18,0.64), rgba(40,28,18,0))",
                                                        textShadow: "0 1px 3px rgba(0,0,0,0.55)",
                                                    }}
                                                >
                                                    <span className="line-clamp-2">{m.label}</span>
                                                </span>
                                            )}
                                            {/* 완료되면 초록 ✓ (FREE 칸 포함) */}
                                            {done && (
                                                <span
                                                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white"
                                                    style={{ background: C.green }}
                                                >
                                                    ✓
                                                </span>
                                            )}
                                        </button>

                                        {/* 마스킹테이프 — 사진이 칸을 꽉 채우므로 폴라로이드 바깥에 얹는다 */}
                                        <span
                                            className="pointer-events-none absolute left-1/2 h-5 w-[52px] rounded-[2px]"
                                            style={{
                                                top: -9,
                                                zIndex: 3,
                                                background: even ? C.tapeCoral : C.tapeMint,
                                                transform: `translateX(-50%) rotate(${even ? -8 : 8}deg)`,
                                            }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* 상태 + 저장 */}
                <div className="mt-2 flex shrink-0 flex-col items-center gap-1.5">
                    <span
                        className="text-sm font-bold"
                        style={{ color: canSave ? C.coral : C.brown, opacity: canSave ? 1 : 0.65 }}
                    >
                        {canSave
                            ? `빙고 ${completedLines}줄 완성! · 미션 ${doneCount}/9`
                            : `미션 ${doneCount}/9 · 한 줄 채우면 저장할 수 있어요`}
                    </span>
                    <button
                        disabled={!canSave || saving}
                        onClick={handleSave}
                        className="w-full rounded-2xl py-3 text-base font-bold transition active:scale-[0.98] disabled:cursor-not-allowed"
                        style={{
                            background: canSave ? C.brown : C.border,
                            color: canSave ? C.textLight : "rgba(90,70,54,0.6)",
                        }}
                    >
                        {saving ? "저장 중…" : canSave ? "📸 사진으로 저장" : "📸 한 줄 완성하고 저장하기"}
                    </button>
                </div>
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
        </div>
    );
}
