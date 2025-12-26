// src/lib/auth.ts

import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { User } from "@prisma/client";

// --- JWT (사용자 인증) 관련 함수들 ---

export function getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET environment variable is required");
    }
    if (secret.length < 32) {
        throw new Error("JWT_SECRET must be at least 32 characters");
    }
    return secret;
}

export function extractBearerToken(request: NextRequest): string | null {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    return authHeader.substring(7);
}

export function verifyJwtAndGetUserId(token: string): string {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret) as { userId?: string };
    if (!decoded?.userId) {
        throw new Error("JWT does not contain userId");
    }
    return decoded.userId;
}

export function getUserIdFromRequest(request: NextRequest): string | null {
    try {
        const token = extractBearerToken(request);
        if (!token) return null;
        return verifyJwtAndGetUserId(token);
    } catch {
        return null;
    }
}

// 통합 인증 헬퍼: 우선순위 1) Authorization: Bearer 토큰, 2) 'auth' 쿠키(JWT)
export function resolveUserId(request: NextRequest): number | null {
    try {
        // 1) Authorization 헤더 우선
        const fromHeader = getUserIdFromRequest(request);
        if (fromHeader && Number.isFinite(Number(fromHeader))) {
            return Number(fromHeader);
        }

        // 2) auth 쿠키(JWT) 디코드
        const token = request.cookies.get("auth")?.value;
        if (!token) return null;
        
        try {
            const payload = jwt.verify(token, getJwtSecret()) as { userId?: number | string };
            if (payload?.userId) {
                const userId = Number(payload.userId);
                if (Number.isFinite(userId) && userId > 0) {
                    return userId;
                }
            }
        } catch (verifyError) {
            // JWT 검증 실패 (만료, 잘못된 토큰 등) - 정상적인 경우이므로 null 반환
            console.warn("[resolveUserId] JWT 검증 실패:", verifyError instanceof Error ? verifyError.message : String(verifyError));
        }
    } catch (error) {
        // 예상치 못한 에러 발생 시 로그만 남기고 null 반환
        console.error("[resolveUserId] 예상치 못한 에러:", error);
    }
    return null;
}

// --- 데이터 보안 처리 관련 함수 ---

/**
 * 사용자 객체에서 비밀번호 필드를 제외합니다.
 * @param user - 사용자 객체
 * @returns 비밀번호가 제외된 사용자 객체
 */
export function excludePassword(user: User) {
    // lodash.omit 대신 비구조화 할당 문법을 사용합니다.
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
}
