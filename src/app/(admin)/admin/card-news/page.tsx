"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { parseTipsFromDb } from "@/types/tip";

/* ── Types ─────────────────────────────────────────────────── */
interface CoursePlace {
    pid: number;
    name: string;
    oi: number;
    seg?: string | null;
    ois?: number | null;
    tip?: string | null;
    imageUrl?: string | null;
}

interface Course {
    id: number;
    title: string;
    sub_title: string | null;
    region: string;
    duration: string;
    budget: string;
    sel: boolean;
    mood: string[];
    places: CoursePlace[];
}

/* TipItem[] JSON에서 첫 번째 팁 content만 꺼냄 */
function parseTip(raw: string | null | undefined): string | null {
    const items = parseTipsFromDb(raw);
    return items[0]?.content ?? null;
}

/* ── API response → internal Course shape ───────────────────── */
function transformCourse(raw: any): Course {
    const places: CoursePlace[] = (raw.coursePlaces ?? raw.places ?? [])
        .sort((a: any, b: any) => a.order_index - b.order_index)
        .map((cp: any) => {
            const tip = parseTip(cp.tips);
            if (process.env.NODE_ENV === "development") {
                console.log(`[card-news] place=${cp.place?.name} raw_tips=${JSON.stringify(cp.tips)} → tip=${tip}`);
            }
            return {
                pid: cp.place_id ?? cp.place?.id,
                name: cp.place?.name ?? "",
                oi: cp.order_index,
                seg: cp.segment ?? null,
                ois: cp.order_in_segment ?? null,
                tip,
                imageUrl: cp.place?.imageUrl ?? null,
            };
        });

    return {
        id: raw.id,
        title: raw.title,
        sub_title: raw.sub_title ?? null,
        region: raw.region ?? "",
        duration: raw.duration ?? "",
        budget: raw.budget_range ?? raw.tags?.budget ?? "",
        sel: raw.isSelectionType ?? false,
        mood: raw.mood ?? raw.tags?.mood ?? [],
        places,
    };
}

const W = 1080, H = 1350;

type SlideType =
    | { type: "cover" }
    | { type: "route" }
    | { type: "place"; place: CoursePlace }
    | { type: "or"; places: CoursePlace[] }
    | { type: "cta" };

function buildSlides(c: Course): SlideType[] {
    const s: SlideType[] = [{ type: "cover" }, { type: "route" }];
    const g: Record<number, CoursePlace[]> = {};
    c.places.forEach((p) => { if (!g[p.oi]) g[p.oi] = []; g[p.oi].push(p); });
    Object.keys(g).sort((a, b) => +a - +b).forEach((k) => {
        const gr = g[+k];
        if (gr.length > 1) s.push({ type: "or", places: gr });
        else s.push({ type: "place", place: gr[0] });
    });
    s.push({ type: "cta" });
    return s;
}

type PosMap = Record<string, { x: number; y: number }>;

function defaultPositions(slide: SlideType): PosMap {
    if (slide.type === "cover") return { title: { x: 70, y: H - 350 }, tags: { x: 70, y: H - 170 } };
    if (slide.type === "route") return {};
    if (slide.type === "place") return { name: { x: 70, y: H - 310 }, tip: { x: 70, y: H - 200 } };
    if (slide.type === "or") {
        const hw = W / 2;
        return { nameA: { x: 40, y: H - 310 }, tipA: { x: 40, y: H - 220 }, nameB: { x: hw + 40, y: H - 310 }, tipB: { x: hw + 40, y: H - 220 } };
    }
    return { main: { x: Math.round(W * 0.15), y: H / 2 - 40 }, arrow: { x: W / 2, y: H / 2 + 50 } };
}

/* ── Canvas helpers ─────────────────────────────────────────── */
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); }
function cf(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) { const ar = img.width / img.height, tar = w / h; let sx = 0, sy = 0, sw = img.width, sh = img.height; if (ar > tar) { sw = img.height * tar; sx = (img.width - sw) / 2; } else { sh = img.width / tar; sy = (img.height - sh) / 2; } ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h); }
function wt(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, mw: number, lh: number) { if (typeof t !== "string" || !t) return y; const ch = [...t]; let l = "", cy = y; for (const c of ch) { const te = l + c; if (ctx.measureText(te).width > mw && l) { ctx.fillText(l, x, cy); l = c; cy += lh; } else l = te; } if (l) ctx.fillText(l, x, cy); return cy; }
function bb(ctx: CanvasRenderingContext2D, r: string) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 8;
    ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(60, H - 105); ctx.lineTo(W - 60, H - 105); ctx.stroke();
    ctx.font = "500 30px 'Pretendard',-apple-system,sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left"; ctx.fillText("서울", 70, H - 58);
    ctx.textAlign = "right"; ctx.fillText(r || "", W - 70, H - 58);
    ctx.restore();
}
function logo(ctx: CanvasRenderingContext2D) { ctx.font = "bold 34px 'Pretendard',-apple-system,sans-serif"; ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.fillText("DoNa", 50, 60); }
function gb(ctx: CanvasRenderingContext2D, sy = H * 0.55) { const g = ctx.createLinearGradient(0, sy, 0, H); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.5, "rgba(0,0,0,.4)"); g.addColorStop(1, "rgba(0,0,0,.75)"); ctx.fillStyle = g; ctx.fillRect(0, sy, W, H - sy); }

/* ── Renderers ──────────────────────────────────────────────── */
function rCover(ctx: CanvasRenderingContext2D, c: Course, ph: Record<number, HTMLImageElement>, pos: PosMap) {
    const img = ph[c.places[0]?.pid];
    if (img) { cf(ctx, img, 0, 0, W, H); ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.fillRect(0, 0, W, H); gb(ctx, H * 0.45); }
    else { const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#1a1a2e"); g.addColorStop(1, "#16213e"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    logo(ctx);
    ctx.font = "bold 52px 'Pretendard',-apple-system,sans-serif"; ctx.fillStyle = "#fff"; ctx.textAlign = "left";
    ctx.shadowColor = "rgba(0,0,0,.6)"; ctx.shadowBlur = 16;
    wt(ctx, c.title, pos.title.x, pos.title.y, W - 140, 64);
    ctx.shadowBlur = 0;
    const tags = ["#두나", ...c.mood.slice(0, 2).map((m) => "#" + m)];
    let px = pos.tags.x; const py = pos.tags.y;
    ctx.font = "500 24px 'Pretendard',-apple-system,sans-serif";
    tags.forEach((tag) => { const tw = ctx.measureText(tag).width; const pw = tw + 36; ctx.fillStyle = "rgba(0,0,0,.6)"; rr(ctx, px, py, pw, 42, 21); ctx.fill(); ctx.fillStyle = "#fff"; ctx.fillText(tag, px + 18, py + 29); px += pw + 12; });
    bb(ctx, c.region);
}

function rPlace(ctx: CanvasRenderingContext2D, c: Course, p: CoursePlace, ph: Record<number, HTMLImageElement>, pos: PosMap) {
    const img = ph[p.pid];
    if (img) { cf(ctx, img, 0, 0, W, H); ctx.fillStyle = "rgba(0,0,0,.15)"; ctx.fillRect(0, 0, W, H); gb(ctx, H * 0.4); }
    else { ctx.fillStyle = "#1a1a2e"; ctx.fillRect(0, 0, W, H); }
    logo(ctx);
    ctx.font = "bold 52px 'Pretendard',-apple-system,sans-serif"; ctx.fillStyle = "#fff"; ctx.textAlign = "left";
    ctx.shadowColor = "rgba(0,0,0,.7)"; ctx.shadowBlur = 16;
    wt(ctx, p.name, pos.name.x, pos.name.y, W - 140, 62); ctx.shadowBlur = 0;
    if (p.tip) { ctx.font = "400 32px 'Pretendard',-apple-system,sans-serif"; ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.shadowColor = "rgba(0,0,0,.5)"; ctx.shadowBlur = 8; wt(ctx, p.tip, pos.tip.x, pos.tip.y, W - 140, 44); ctx.shadowBlur = 0; }
    bb(ctx, c.region);
}

function rOr(ctx: CanvasRenderingContext2D, c: Course, ps: CoursePlace[], ph: Record<number, HTMLImageElement>, pos: PosMap) {
    const [a, b] = ps; const hw = W / 2 - 3;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, hw, H); ctx.clip();
    const ia = ph[a.pid]; if (ia) cf(ctx, ia, 0, 0, hw, H); else { ctx.fillStyle = "#1e293b"; ctx.fillRect(0, 0, hw, H); }
    const gA = ctx.createLinearGradient(0, H * 0.5, 0, H); gA.addColorStop(0, "rgba(0,0,0,0)"); gA.addColorStop(1, "rgba(0,0,0,.7)"); ctx.fillStyle = gA; ctx.fillRect(0, H * 0.5, hw, H * 0.5); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(hw + 6, 0, hw, H); ctx.clip();
    const ib = ph[b.pid]; if (ib) cf(ctx, ib, hw + 6, 0, hw, H); else { ctx.fillStyle = "#0f172a"; ctx.fillRect(hw + 6, 0, hw, H); }
    const gB = ctx.createLinearGradient(0, H * 0.5, 0, H); gB.addColorStop(0, "rgba(0,0,0,0)"); gB.addColorStop(1, "rgba(0,0,0,.7)"); ctx.fillStyle = gB; ctx.fillRect(hw + 6, H * 0.5, hw, H * 0.5); ctx.restore();
    ctx.fillStyle = "#fff"; ctx.fillRect(hw, 0, 6, H);
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(W / 2, H / 2, 36, 0, Math.PI * 2); ctx.fill();
    ctx.font = "bold 28px 'Pretendard',sans-serif"; ctx.fillStyle = "#1e293b"; ctx.textAlign = "center"; ctx.fillText("or", W / 2, H / 2 + 10); ctx.textAlign = "left";
    ctx.font = "bold 44px 'Pretendard',sans-serif"; ctx.fillStyle = "#fff";
    ctx.shadowColor = "rgba(0,0,0,.7)"; ctx.shadowBlur = 12; wt(ctx, a.name, pos.nameA.x, pos.nameA.y, hw - 60, 54); ctx.shadowBlur = 0;
    if (a.tip) { ctx.font = "400 28px 'Pretendard',sans-serif"; ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.shadowColor = "rgba(0,0,0,.5)"; ctx.shadowBlur = 6; wt(ctx, a.tip, pos.tipA.x, pos.tipA.y, hw - 60, 36); ctx.shadowBlur = 0; }
    ctx.font = "bold 44px 'Pretendard',sans-serif"; ctx.fillStyle = "#fff";
    ctx.shadowColor = "rgba(0,0,0,.7)"; ctx.shadowBlur = 12; wt(ctx, b.name, pos.nameB.x, pos.nameB.y, hw - 60, 54); ctx.shadowBlur = 0;
    if (b.tip) { ctx.font = "400 28px 'Pretendard',sans-serif"; ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.shadowColor = "rgba(0,0,0,.5)"; ctx.shadowBlur = 6; wt(ctx, b.tip, pos.tipB.x, pos.tipB.y, hw - 60, 36); ctx.shadowBlur = 0; }
    logo(ctx); bb(ctx, c.region);
}

function rCta(ctx: CanvasRenderingContext2D, c: Course, _ph: Record<number, HTMLImageElement>, pos: PosMap) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#111111"); g.addColorStop(1, "#000000"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    logo(ctx);
    ctx.textAlign = "left";
    ctx.font = "500 42px 'Pretendard',-apple-system,sans-serif"; ctx.fillStyle = "#fff";
    ctx.fillText("이 코스의 더 자세한 이야기는", pos.main.x, pos.main.y);
    const ay = pos.arrow.y;
    ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W * 0.15, ay); ctx.lineTo(W * 0.58, ay); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W * 0.58, ay); ctx.lineTo(W * 0.56, ay - 6); ctx.lineTo(W * 0.56, ay + 6); ctx.closePath(); ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.fill();
    ctx.font = "bold 48px 'Pretendard',-apple-system,sans-serif"; ctx.fillStyle = "#fff";
    ctx.fillText("DoNa", W * 0.63, ay + 14);
    ctx.textAlign = "left"; bb(ctx, c.region);
}

function rTimeline(ctx: CanvasRenderingContext2D, c: Course) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0d0d0d"); bg.addColorStop(1, "#030303");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    logo(ctx);

    // order_index 기준으로 그룹핑 (buildSlides와 동일)
    const g: Record<number, CoursePlace[]> = {};
    c.places.forEach((p) => { if (!g[p.oi]) g[p.oi] = []; g[p.oi].push(p); });
    const stops = Object.keys(g).sort((a, b) => +a - +b).map((k) => g[+k]);

    const n = stops.length;
    const cx = W / 2;
    const areaTop = 90, areaBottom = H - 160;
    const spacing = 260;
    const blockH = (n - 1) * spacing;
    const startY = Math.round((areaTop + areaBottom) / 2 - blockH / 2);

    // 세로 점선
    ctx.strokeStyle = "rgba(255,255,255,0.22)"; ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.beginPath(); ctx.moveTo(cx, startY - 20); ctx.lineTo(cx, startY + blockH + 20); ctx.stroke();
    ctx.setLineDash([]);

    const dotR = 18, connLen = 90, maxNameW = 390, lh = 42;

    const drawName = (name: string, x: number, y: number, align: CanvasTextAlign) => {
        ctx.textAlign = align;
        ctx.font = "600 36px 'Pretendard',-apple-system,sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 8;
        if (ctx.measureText(name).width <= maxNameW) {
            ctx.fillText(name, x, y + 13);
        } else {
            let l1 = "";
            for (let ci = 0; ci < name.length; ci++) {
                if (ctx.measureText(l1 + name[ci]).width > maxNameW) break;
                l1 += name[ci];
            }
            ctx.fillText(l1, x, y + 13 - lh / 2);
            ctx.fillText(name.slice(l1.length), x, y + 13 + lh / 2);
        }
        ctx.shadowBlur = 0;
    };

    let singleIdx = 0;
    stops.forEach((group, i) => {
        const y = n > 1 ? startY + i * spacing : Math.round((areaTop + areaBottom) / 2);
        const isOr = group.length > 1;

        // 점
        ctx.beginPath(); ctx.arc(cx, y, dotR, 0, Math.PI * 2);
        ctx.fillStyle = i === 0 ? "#22c55e" : isOr ? "#f59e0b" : "#ffffff"; ctx.fill();
        ctx.font = "700 16px 'Pretendard',-apple-system,sans-serif";
        ctx.fillStyle = "#000000"; ctx.textAlign = "center";
        ctx.fillText(isOr ? "or" : String(singleIdx + 1), cx, y + 6);

        if (isOr) {
            const [a, b] = group;
            ctx.strokeStyle = "rgba(255,255,255,0.28)"; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(cx - dotR, y); ctx.lineTo(cx - dotR - connLen, y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(cx + dotR, y); ctx.lineTo(cx + dotR + connLen, y); ctx.stroke();
            drawName(a.name, cx - dotR - connLen - 16, y, "right");
            drawName(b.name, cx + dotR + connLen + 16, y, "left");
        } else {
            const p = group[0];
            const isLeft = singleIdx % 2 === 0;
            ctx.strokeStyle = "rgba(255,255,255,0.28)"; ctx.lineWidth = 1.5;
            ctx.beginPath();
            if (isLeft) { ctx.moveTo(cx - dotR, y); ctx.lineTo(cx - dotR - connLen, y); }
            else { ctx.moveTo(cx + dotR, y); ctx.lineTo(cx + dotR + connLen, y); }
            ctx.stroke();
            drawName(p.name, isLeft ? cx - dotR - connLen - 16 : cx + dotR + connLen + 16, y, isLeft ? "right" : "left");
            singleIdx++;
        }
    });
    bb(ctx, c.region);
}

/* ── Drag handle ────────────────────────────────────────────── */
function DragHandle({ label, x, y, scale, onMove, color = "#059669" }: {
    label: string; x: number; y: number; scale: number;
    onMove: (v: { x: number; y: number }) => void; color?: string;
}) {
    const dragging = useRef(false);
    const startPos = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });

    const onDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        const ev = "touches" in e ? e.touches[0] : e;
        dragging.current = true;
        startPos.current = { mx: ev.clientX, my: ev.clientY, ox: x, oy: y };
        const onMv = (e2: MouseEvent | TouchEvent) => {
            if (!dragging.current) return;
            const ev2 = "touches" in e2 ? e2.touches[0] : e2;
            const dx = (ev2.clientX - startPos.current.mx) / scale;
            const dy = (ev2.clientY - startPos.current.my) / scale;
            onMove({ x: Math.round(startPos.current.ox + dx), y: Math.round(startPos.current.oy + dy) });
        };
        const onUp = () => { dragging.current = false; window.removeEventListener("mousemove", onMv); window.removeEventListener("mouseup", onUp); window.removeEventListener("touchmove", onMv); window.removeEventListener("touchend", onUp); };
        window.addEventListener("mousemove", onMv); window.addEventListener("mouseup", onUp);
        window.addEventListener("touchmove", onMv, { passive: false }); window.addEventListener("touchend", onUp);
    }, [x, y, scale, onMove]);

    return (
        <div onMouseDown={onDown} onTouchStart={onDown} style={{ position: "absolute", left: x * scale, top: y * scale, transform: "translate(-50%,-50%)", background: color, color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, cursor: "grab", userSelect: "none", whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(0,0,0,.3)", zIndex: 10, touchAction: "none" }}>
            ⠿ {label}
        </div>
    );
}

/* ── Main ───────────────────────────────────────────────────── */
export default function CardNewsPage() {
    const [fontReady, setFontReady] = useState(false);
    const [courses, setCourses] = useState<Course[]>([]);
    const [coursesLoading, setCoursesLoading] = useState(true);
    const [selId, setSelId] = useState<number | null>(null);
    const [photos, setPhotos] = useState<Record<number, HTMLImageElement>>({});
    const [previews, setPreviews] = useState<string[]>([]);
    const [activeIdx, setActiveIdx] = useState(0);
    const [generating, setGen] = useState(false);
    const [positions, setPositions] = useState<Record<number, PosMap>>({});
    const [editMode, setEditMode] = useState(false);
    const [imgStatus, setImgStatus] = useState<"" | "loading" | "done" | "error">("");
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const [previewW, setPreviewW] = useState(400);

    // CSS @font-face injection → document.fonts.ready (더 안정적으로 canvas에 적용됨)
    useEffect(() => {
        const base = "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/woff2";
        const style = document.createElement("style");
        style.textContent = `
            @font-face { font-family: 'Pretendard'; src: url('${base}/Pretendard-Regular.woff2') format('woff2'); font-weight: 400; font-display: block; }
            @font-face { font-family: 'Pretendard'; src: url('${base}/Pretendard-Medium.woff2') format('woff2'); font-weight: 500; font-display: block; }
            @font-face { font-family: 'Pretendard'; src: url('${base}/Pretendard-Bold.woff2') format('woff2'); font-weight: 700; font-display: block; }
        `;
        document.head.appendChild(style);
        document.fonts.ready.then(() => setFontReady(true));
        return () => { document.head.removeChild(style); };
    }, []);

    // Fetch all public courses from DB
    useEffect(() => {
        fetch("/api/admin/courses")
            .then((r) => r.json())
            .then((data: any[]) => {
                const filtered = data.filter((c) => c.isPublic && c.grade === "FREE");
                if (process.env.NODE_ENV === "development") {
                    filtered.slice(0, 3).forEach((c) => console.log(`[card-news] course id=${c.id} region=${JSON.stringify(c.region)} places_count=${c.places?.length}`));
                }
                setCourses(filtered.map(transformCourse));
                setCoursesLoading(false);
            })
            .catch(() => setCoursesLoading(false));
    }, []);

    const course = courses.find((c) => c.id === selId) ?? null;
    const slides: SlideType[] = course ? buildSlides(course) : [];
    const uniP: CoursePlace[] = course
        ? course.places.filter((p, i, a) => a.findIndex((x) => x.pid === p.pid) === i)
        : [];
    const scale = previewW / W;

    // Auto-load images via proxy (avoids CloudFront CORS restriction on canvas)
    useEffect(() => {
        if (!course) return;
        const toLoad = uniP.filter((p) => p.imageUrl);
        if (!toLoad.length) return;
        setImgStatus("loading");
        let loaded = 0, failed = 0;
        toLoad.forEach((p) => {
            const img = new Image();
            img.onload = () => {
                setPhotos((prev) => ({ ...prev, [p.pid]: img }));
                loaded++;
                if (loaded + failed === toLoad.length) setImgStatus(failed > 0 ? "error" : "done");
            };
            img.onerror = () => {
                failed++;
                if (loaded + failed === toLoad.length) setImgStatus(failed === toLoad.length ? "error" : "done");
            };
            img.src = `/api/admin/image-proxy?url=${encodeURIComponent(p.imageUrl!)}`;
        });
    }, [selId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Init positions when course changes
    useEffect(() => {
        if (!course) return;
        const sl = buildSlides(course);
        const pos: Record<number, PosMap> = {};
        sl.forEach((s, i) => { pos[i] = defaultPositions(s); });
        setPositions(pos);
    }, [selId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Measure preview container width
    useEffect(() => {
        if (!previewRef.current) return;
        const obs = new ResizeObserver((entries) => {
            for (const e of entries) setPreviewW(e.contentRect.width);
        });
        obs.observe(previewRef.current);
        return () => obs.disconnect();
    }, [previews]);

    const bulkUp = useCallback((files: FileList) => {
        const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        sorted.forEach((file, i) => {
            if (i >= uniP.length) return;
            const r = new FileReader();
            r.onload = (e) => { const img = new Image(); img.onload = () => setPhotos((prev) => ({ ...prev, [uniP[i].pid]: img })); img.src = e.target!.result as string; };
            r.readAsDataURL(file);
        });
    }, [uniP]);

    const singleUp = useCallback((pid: number, file: File) => {
        const r = new FileReader();
        r.onload = (e) => { const img = new Image(); img.onload = () => setPhotos((prev) => ({ ...prev, [pid]: img })); img.src = e.target!.result as string; };
        r.readAsDataURL(file);
    }, []);

    const renderOne = useCallback((ctx: CanvasRenderingContext2D, slideIdx: number) => {
        if (!course) return "";
        const s = slides[slideIdx];
        const pos = positions[slideIdx] || defaultPositions(s);
        ctx.clearRect(0, 0, W, H); ctx.save(); ctx.textBaseline = "alphabetic";
        if (s.type === "cover") rCover(ctx, course, photos, pos);
        else if (s.type === "route") rTimeline(ctx, course);
        else if (s.type === "place") rPlace(ctx, course, s.place, photos, pos);
        else if (s.type === "or") rOr(ctx, course, s.places, photos, pos);
        else if (s.type === "cta") rCta(ctx, course, photos, pos);
        ctx.restore();
        return ctx.canvas.toDataURL("image/png");
    }, [slides, course, photos, positions]);

    const generate = useCallback(async () => {
        if (!course || !fontReady) return;
        setGen(true);
        const cv = canvasRef.current!; cv.width = W; cv.height = H;
        const ctx = cv.getContext("2d")!;
        const res: string[] = [];
        for (let i = 0; i < slides.length; i++) res.push(renderOne(ctx, i));
        setPreviews(res); setActiveIdx(0); setGen(false);
    }, [course, slides, renderOne, fontReady]);

    const regenCurrent = useCallback(() => {
        if (!course || !previews.length) return;
        const cv = canvasRef.current!; cv.width = W; cv.height = H;
        const url = renderOne(cv.getContext("2d")!, activeIdx);
        setPreviews((prev) => { const n = [...prev]; n[activeIdx] = url; return n; });
    }, [course, activeIdx, renderOne, previews.length]);

    const updatePos = useCallback((slideIdx: number, key: string, val: { x: number; y: number }) => {
        setPositions((prev) => ({ ...prev, [slideIdx]: { ...(prev[slideIdx] || {}), [key]: val } }));
    }, []);

    useEffect(() => {
        if (editMode && previews.length > 0) {
            const t = setTimeout(regenCurrent, 80);
            return () => clearTimeout(t);
        }
    }, [positions, editMode]); // eslint-disable-line react-hooks/exhaustive-deps

    const slideName = (i: number) => {
        if (!course) return `dona_${i + 1}.png`;
        const s = slides[i];
        let n = `dona_${course.id}_${i + 1}`;
        if (s.type === "cover") n += "_cover";
        else if (s.type === "route") n += "_route";
        else if (s.type === "cta") n += "_cta";
        else if (s.type === "or") n += "_or";
        else n += `_${s.place.name.replace(/\s/g, "").slice(0, 8)}`;
        return n + ".png";
    };

    const dl = (i: number) => {
        if (!previews[i] || !course) return;
        const a = document.createElement("a");
        a.href = previews[i];
        a.download = slideName(i);
        a.click();
    };

    const dlAll = () => previews.forEach((_, i) => setTimeout(() => dl(i), i * 250));

    const shareAll = useCallback(async () => {
        if (!previews.length || !course) return;
        const files = previews.map((dataUrl, i) => {
            const [header, b64] = dataUrl.split(",");
            const mime = header.match(/:(.*?);/)![1];
            const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
            return new File([bytes], slideName(i), { type: mime });
        });
        try {
            await navigator.share({ files, title: course.title });
        } catch {
            // 취소했거나 share 미지원 → 일반 다운로드로 폴백
            dlAll();
        }
    }, [previews, course, slides]); // eslint-disable-line react-hooks/exhaustive-deps

    const canShare = typeof navigator !== "undefined" && !!navigator.share;
    const upCnt = uniP.filter((p) => photos[p.pid]).length;

    const curSlide = slides[activeIdx];
    const curPos = positions[activeIdx] || {};
    const handleLabels: Record<string, string> = {
        title: "제목", tags: "태그", name: "장소명", tip: "팁",
        nameA: "A 장소명", tipA: "A 팁", nameB: "B 장소명", tipB: "B 팁",
        main: "메인 텍스트", arrow: "화살표",
    };

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">인스타 카드뉴스 생성</h1>
                <p className="text-sm text-gray-500 mt-1">1080×1350 (4:5) · 드래그로 텍스트 위치 조절</p>
                {!fontReady && <p className="text-xs text-amber-600 mt-1">폰트 로딩 중...</p>}
            </div>

            <canvas ref={canvasRef} style={{ display: "none" }} />

            <div className="space-y-4">
                {/* STEP 1 */}
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <div className="text-xs font-bold text-green-600 mb-3 tracking-widest">STEP 1 — 코스 선택</div>
                    {coursesLoading ? (
                        <div className="text-sm text-gray-400 py-3">코스 불러오는 중...</div>
                    ) : (
                        <select
                            value={selId || ""}
                            onChange={(e) => { setSelId(+e.target.value || null); setPhotos({}); setPreviews([]); setEditMode(false); setImgStatus(""); }}
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                            <option value="">공개 코스 {courses.length}개 중 선택</option>
                            {courses.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.sel ? "🔀 " : ""}{c.title} — {c.region}
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                {course && <>
                    {/* Course summary */}
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                        <div className="font-semibold text-gray-800">{course.title}</div>
                        <div className="text-xs text-green-700 mb-2">{course.sub_title}</div>
                        <div className="flex flex-wrap gap-2">
                            {[`📍 ${course.region}`, `⏱ ${course.duration}`, `💰 ${course.budget}`].map((t, i) => (
                                <span key={i} className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full">{t}</span>
                            ))}
                            {course.sel && <span className="text-xs bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full">🔀 선택형</span>}
                            <span className="text-xs bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full">📄 {slides.length}장</span>
                        </div>
                    </div>

                    {/* STEP 2 */}
                    <div className="bg-white border border-gray-200 rounded-xl p-5">
                        <div className="flex justify-between items-center mb-3">
                            <div className="text-xs font-bold text-green-600 tracking-widest">STEP 2 — 사진</div>
                            <div className={`text-xs font-medium ${upCnt === uniP.length ? "text-green-600" : "text-gray-400"}`}>
                                {imgStatus === "loading" ? "⏳ 로딩 중..." : `${upCnt}/${uniP.length}${upCnt === uniP.length ? " ✓" : ""}`}
                            </div>
                        </div>
                        {imgStatus === "done" && <div className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2 mb-3">✅ DB 이미지 {upCnt}장 자동 로드 완료</div>}
                        {imgStatus === "error" && <div className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-3">⚠️ 일부 이미지 로드 실패 — 아래에서 수동 업로드 가능</div>}

                        <div
                            onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "#059669"; }}
                            onDragLeave={(e) => { e.currentTarget.style.borderColor = "#d1d5db"; }}
                            onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "#d1d5db"; if (e.dataTransfer.files.length) bulkUp(e.dataTransfer.files); }}
                            onClick={() => fileRef.current?.click()}
                            className="border-2 border-dashed border-gray-300 rounded-xl p-5 text-center cursor-pointer hover:border-green-500 transition-colors mb-4"
                        >
                            <div className="text-2xl mb-1">📂</div>
                            <div className="text-sm font-semibold text-gray-700">수동 업로드 (이미지 교체용)</div>
                            <div className="text-xs text-gray-400 mt-1">DB 이미지를 다른 걸로 쓰고 싶을 때만 사용</div>
                            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files?.length && bulkUp(e.target.files)} />
                        </div>

                        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(90px,1fr))" }}>
                            {uniP.map((p, i) => (
                                <label key={p.pid} style={{ position: "relative", aspectRatio: "3/4", borderRadius: 8, overflow: "hidden", border: photos[p.pid] ? "2px solid #059669" : "1.5px dashed #d1d5db", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: photos[p.pid] ? "#000" : "#fafafa" }}>
                                    {photos[p.pid]
                                        ? <img src={photos[p.pid].src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                        : <><span style={{ fontSize: 16 }}>{i + 1}</span><span style={{ fontSize: 8, color: "#9ca3af", textAlign: "center", padding: "0 4px", lineHeight: 1.2 }}>{p.name.slice(0, 10)}</span></>
                                    }
                                    <input type="file" accept="image/*" style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} onChange={(e) => e.target.files?.[0] && singleUp(p.pid, e.target.files[0])} />
                                    {photos[p.pid] && <div style={{ position: "absolute", top: 2, right: 2, background: "#059669", borderRadius: 99, width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "#fff", fontSize: 8 }}>✓</span></div>}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* STEP 3 */}
                    <div className="bg-white border border-gray-200 rounded-xl p-5">
                        <div className="text-xs font-bold text-green-600 mb-4 tracking-widest">STEP 3 — 생성 & 편집</div>
                        <button
                            onClick={generate}
                            disabled={generating || !fontReady}
                            className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-colors disabled:cursor-not-allowed"
                            style={{ background: generating || !fontReady ? "#9ca3af" : "#059669" }}
                        >
                            {generating ? "생성 중..." : !fontReady ? "폰트 로딩 중..." : `🎨 카드뉴스 생성 (${slides.length}장)`}
                        </button>

                        {previews.length > 0 && <div className="mt-5">
                            <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
                                {slides.map((s, i) => (
                                    <button key={i} onClick={() => setActiveIdx(i)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border-none cursor-pointer"
                                        style={{ background: i === activeIdx ? "#059669" : "#e5e7eb", color: i === activeIdx ? "#fff" : "#64748b" }}
                                    >
                                        {s.type === "cover" ? "커버" : s.type === "route" ? "동선" : s.type === "cta" ? "CTA" : s.type === "or" ? `or ${s.places.map((p) => p.name.slice(0, 3)).join("·")}` : s.place.name.slice(0, 8)}
                                    </button>
                                ))}
                            </div>

                            <div className="flex justify-end mb-2">
                                <button
                                    onClick={() => setEditMode(!editMode)}
                                    className="px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                                    style={{ border: editMode ? "2px solid #f59e0b" : "1px solid #d1d5db", background: editMode ? "#fef3c7" : "#fff", color: editMode ? "#92400e" : "#6b7280" }}
                                >
                                    {editMode ? "✏️ 편집 중 (드래그로 이동)" : "✏️ 텍스트 위치 편집"}
                                </button>
                            </div>

                            <div className="flex justify-center">
                                <div ref={previewRef} className="w-full max-w-sm relative">
                                    {previews[activeIdx] && <img src={previews[activeIdx]} alt="" className="w-full rounded-xl shadow-lg block" />}
                                    {editMode && curSlide && Object.keys(curPos).map((key) => (
                                        <DragHandle key={key} label={handleLabels[key] || key} x={curPos[key].x} y={curPos[key].y} scale={scale}
                                            color={key.includes("B") ? "#f59e0b" : "#059669"}
                                            onMove={(val) => updatePos(activeIdx, key, val)} />
                                    ))}
                                </div>
                            </div>

                            {editMode && <p className="text-center text-xs text-gray-400 mt-2">핸들을 드래그하면 실시간 반영됩니다</p>}

                            <div className="flex gap-2 mt-4">
                                <button onClick={() => dl(activeIdx)} className="flex-1 py-3 rounded-xl text-sm font-semibold border border-green-600 text-green-700 bg-white hover:bg-green-50 cursor-pointer transition-colors">이 슬라이드</button>
                                <button onClick={canShare ? shareAll : dlAll} className="flex-1 py-3 rounded-xl text-sm font-semibold bg-green-600 text-white hover:bg-green-700 cursor-pointer transition-colors border-none">
                                    {canShare ? `📤 공유하기 (${slides.length}장)` : `⬇️ 전체 다운로드 (${slides.length}장)`}
                                </button>
                            </div>
                        </div>}
                    </div>
                </>}
            </div>
        </div>
    );
}
