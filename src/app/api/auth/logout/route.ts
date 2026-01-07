import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
    const res = NextResponse.json({ success: true });

    // 🟢 [배포용 최종 Fix]: 스크린샷에서 확인된 모든 쿠키 이름을 정확히 나열
    // 브라우저가 여전히 들고 있을 수 있는 모든 인증 관련 쿠키를 명시적으로 삭제
    const cookiesToClear = ["authorization", "auth", "isLoggedIn", "admin_auth"];

    // 🟢 [배포용 최종 핵무기]: WebView 및 모든 브라우저 호환성을 위한 옵션 정석
    // Domain 앞에 점(.)을 붙이면 모든 서브도메인에서 쿠키가 박멸됩니다
    const options =
        "Path=/; Domain=.dona.io.kr; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=None";
    // 🟢 Domain 없이도 삭제 시도 (일부 환경에서 Domain이 문제가 될 수 있음)
    const optionsWithoutDomain = "Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=None";

    cookiesToClear.forEach((name) => {
        // HttpOnly 버전과 일반 버전, Domain 포함/미포함 버전 모두 삭제 명령을 보냅니다.
        res.headers.append("Set-Cookie", `${name}=; ${options}; HttpOnly`);
        res.headers.append("Set-Cookie", `${name}=; ${options}`);
        res.headers.append("Set-Cookie", `${name}=; ${optionsWithoutDomain}; HttpOnly`);
        res.headers.append("Set-Cookie", `${name}=; ${optionsWithoutDomain}`);
    });

    // 🟢 캐시를 완전히 날려서 ?t= 루프를 방지합니다.
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    res.headers.set("Pragma", "no-cache");
    res.headers.set("Expires", "0");

    return res;
}
