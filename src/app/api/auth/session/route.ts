import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "@/lib/auth";
import prisma from "@/lib/db";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

/**
 * 🟢 세션 확인 API (쿠키 기반)
 *
 * 쿠키에 저장된 JWT 토큰을 검증하고 사용자 정보를 반환합니다.
 * JWT 검증을 통해 토큰이 유효한지 확인합니다.
 */
export async function GET(req: NextRequest) {
    try {
        // 🟢 [Magic Fix]: 아이패드 웹뷰의 쿠키 동기화 시간을 위해 의도적으로 지연
        // 앱을 다시 빌드할 수 없으므로, 서버가 응답을 늦게 줘서 웹뷰가 쿠키를 저장할 시간을 벌어줍니다.
        const userAgent = req.headers.get("user-agent") || "";
        const isApp = /ReactNative|Expo/i.test(userAgent);

        // 🟢 [Fix]: 쿠키가 있는 경우에만 지연 (로그인 후 쿠키 저장 시간 확보)
        // 로그아웃 시에는 지연하지 않아 빠른 응답 제공
        const token = req.cookies.get("auth")?.value;
        if (isApp && token) {
            // 🟢 [Fix]: 앱 환경에서 쿠키가 있는 경우(로그인 후) 쿠키 동기화를 위해 2초 대기
            // WebScreen.tsx가 500ms 후에 리다이렉트하므로, 그 전에 쿠키가 저장되도록 충분한 시간 확보
            // 스플래시가 다 나온 다음 메인으로 가도록 시간을 더 늘림
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        if (!token) {
            return NextResponse.json({ authenticated: false, user: null });
        }

        // 🟢 JWT 검증 (단순 디코드가 아닌 검증)
        let payload: any;
        try {
            payload = jwt.verify(token, getJwtSecret()) as any;
        } catch (verifyError) {

                captureApiError(verifyError);
            // 토큰이 만료되었거나 유효하지 않은 경우
            console.warn("[Session API] JWT 검증 실패:", verifyError);
            return NextResponse.json({ authenticated: false, user: null });
        }

        // 🟢 사용자 ID 추출
        const userId = payload?.userId;
        if (!userId) {
            return NextResponse.json({ authenticated: false, user: null });
        }

        // 🟢 DB에서 최신 사용자 정보 조회 (선택적, 성능 최적화를 위해 필요한 경우만)
        // 토큰에 이미 정보가 있으므로 DB 조회는 선택적으로 처리
        let userInfo = {
            id: Number(userId),
            email: payload?.email || "",
            name: payload?.name || payload?.nickname || "",
            nickname: payload?.nickname || payload?.name || "",
        };

        // 🟢 DB에서 최신 정보 가져오기 (닉네임 등 최신 정보 반영)
        try {
            const dbUser = await prisma.user.findUnique({
                where: { id: Number(userId) },
                select: { id: true, email: true, username: true },
            });
            if (dbUser) {
                // 🟢 username이 있고 user_로 시작하지 않으면 사용 (실제 이름)
                // user_로 시작하면 임시 이름이므로 이메일 앞부분 사용
                let displayName = "";

                if (dbUser.username && dbUser.username.trim() !== "") {
                    const trimmedUsername = dbUser.username.trim();
                    // user_로 시작하는 임시 이름이면 이메일 앞부분 사용
                    if (trimmedUsername.startsWith("user_")) {
                        displayName =
                            dbUser.email && dbUser.email.includes("@") ? dbUser.email.split("@")[0] : trimmedUsername;
                    } else {
                        // 실제 이름이면 그대로 사용
                        displayName = trimmedUsername;
                    }
                } else if (payload?.name && payload.name.trim() !== "") {
                    displayName = payload.name.trim();
                } else if (payload?.nickname && payload.nickname.trim() !== "") {
                    displayName = payload.nickname.trim();
                } else if (dbUser.email && dbUser.email.includes("@")) {
                    displayName = dbUser.email.split("@")[0];
                }

                userInfo = {
                    id: dbUser.id,
                    email: dbUser.email || payload?.email || "",
                    name: displayName,
                    nickname: displayName,
                };

                console.log("[Session API] 사용자 정보 반환:", {
                    userId: dbUser.id,
                    dbUsername: dbUser.username,
                    jwtName: payload?.name,
                    displayName,
                    isTemporaryName: dbUser.username?.startsWith("user_"),
                });
            } else {
                // 🟢 DB에 사용자가 없어도 JWT 정보로 이름 설정
                const displayName = payload?.name || payload?.nickname || "";
                userInfo = {
                    ...userInfo,
                    name: displayName,
                    nickname: displayName,
                };
            }
        } catch (dbError) {

                captureApiError(dbError);
            console.warn("[Session API] DB 조회 실패, 토큰 정보 사용:", dbError);
            // 🟢 DB 조회 실패 시에도 JWT 정보로 이름 설정
            const displayName = payload?.name || payload?.nickname || "";
            userInfo = {
                ...userInfo,
                name: displayName,
                nickname: displayName,
            };
        }

        return NextResponse.json({
            authenticated: true,
            user: userInfo,
        });
    } catch (error) {

            captureApiError(error);
        console.error("[Session API] 세션 확인 오류:", error);
        return NextResponse.json({ authenticated: false, user: null });
    }
}
