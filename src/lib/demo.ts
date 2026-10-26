// 체험용 관리자 데모 (DEMO_MODE=true 인 별도 Vercel 프로젝트에서만). 운영에는 DEMO_MODE가 없어 여기 함수는 전부 그냥 통과
// Edge(미들웨어)에서도 import하므로 Node 전용 모듈은 쓰지 않음

export const isDemoMode = () => process.env.DEMO_MODE === "true";

export const DEMO_BLOCKED_MESSAGE = "데모에서는 저장되지 않아요";
/** 막힌 응답에 붙는 헤더. 관리자 화면이 이걸 보고 안내 토스트를 띄움 */
export const DEMO_BLOCKED_HEADER = "x-dona-demo-blocked";

export class DemoBlockedError extends Error {
    constructor(what: string) {
        super(`${DEMO_BLOCKED_MESSAGE} (${what})`);
        this.name = "DemoBlockedError";
    }
}

/** 바깥 서비스 호출 직전에 부름: 데모면 예외 */
export function assertNotDemo(what: string) {
    if (isDemoMode()) throw new DemoBlockedError(what);
}

export function demoBlockedResponse(status = 403) {
    return new Response(JSON.stringify({ error: DEMO_BLOCKED_MESSAGE, demo: true }), {
        status,
        headers: { "Content-Type": "application/json; charset=utf-8", [DEMO_BLOCKED_HEADER]: "1" },
    });
}
