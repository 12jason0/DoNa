// 데모 서버의 바깥 호출 차단 (instrumentation.ts가 DEMO_MODE일 때만 설치)
// fetch를 쓰는 SDK 전부(Claude·토스·텔레그램·Expo 푸시·Resend·Slack·DeepL·카카오·구글·네이버·인스타·Upstash)가 여기서 막힘.
// 허용: 자기 자신(localhost, Vercel 배포 주소), Vercel 자체 데이터 캐시(*.vercel-infra.com), DEMO_ALLOWED_HOSTS(쉼표 구분)에 적은 호스트만
import { DemoBlockedError } from "./demo";

type GuardedFetch = typeof fetch & { __donaDemoGuard?: true };

function allowedHosts(): Set<string> {
    return new Set(
        [
            "localhost",
            "127.0.0.1",
            "[::1]",
            process.env.VERCEL_URL,
            process.env.VERCEL_BRANCH_URL,
            process.env.VERCEL_PROJECT_PRODUCTION_URL,
            ...(process.env.DEMO_ALLOWED_HOSTS || "").split(","),
        ]
            .map((h) => (h || "").trim().toLowerCase())
            .filter(Boolean)
    );
}

function hostOf(input: Parameters<typeof fetch>[0]): string | null {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    try {
        return new URL(url).hostname.toLowerCase();
    } catch {
        return null; // 상대 경로 = 자기 자신
    }
}

export function installDemoFetchGuard() {
    const original = globalThis.fetch as GuardedFetch;
    if (original.__donaDemoGuard) return;
    const allowed = allowedHosts();
    const guarded: GuardedFetch = (input, init) => {
        const host = hostOf(input);
        if (host && !allowed.has(host) && !host.endsWith(".vercel-infra.com")) {
            console.warn(`[demo] 바깥 호출 차단: ${host}`);
            return Promise.reject(new DemoBlockedError(`바깥 호출 ${host}`));
        }
        return original(input, init);
    };
    guarded.__donaDemoGuard = true;
    globalThis.fetch = guarded;
    console.log(`[demo] 바깥 호출 차단 켜짐 (허용: ${[...allowed].join(", ")})`);
}
