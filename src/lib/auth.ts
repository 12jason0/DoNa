// src/lib/auth.ts

import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { User } from "@prisma/client";
import prisma from "@/lib/db";
import { serverConfig } from "@/lib/config";

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

/** 로그인 JWT 발급. tv = users.token_version (로그아웃·비밀번호 변경으로 +1 되면 이 토큰은 무효) */
export function signAuthToken(user: { id: number; username: string; email?: string | null; tokenVersion: number }): string {
    // select에서 tokenVersion을 빼먹으면 tv가 비어 0으로 발급돼 바로 401이 나므로 여기서 막는다
    if (!Number.isInteger(user.tokenVersion)) throw new Error("signAuthToken: tokenVersion is required");
    return jwt.sign(
        { userId: user.id, name: user.username, ...(user.email ? { email: user.email } : {}), tv: user.tokenVersion },
        getJwtSecret(),
        { expiresIn: serverConfig.authTokenMaxAgeSec }
    );
}

/** auth 쿠키 설정 (예전 authorization 쿠키는 지움) */
export function setAuthCookie(res: NextResponse, token: string): void {
    res.cookies.delete("authorization");
    res.cookies.set("auth", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: serverConfig.authTokenMaxAgeSec,
    });
}

/** 서명·만료 확인 후 DB의 token_version과 비교. tv 없는 예전 토큰은 0으로 본다. 통과하면 userId, 아니면 null */
export async function verifyAuthToken(token: string): Promise<number | null> {
    let payload: { userId?: number | string; tv?: number };
    try {
        payload = jwt.verify(token, getJwtSecret()) as typeof payload;
    } catch {
        return null;
    }
    const userId = Number(payload?.userId);
    if (!Number.isInteger(userId) || userId <= 0) return null;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { tokenVersion: true } });
    if (!user || user.tokenVersion !== (payload.tv ?? 0)) return null;
    return userId;
}

export function extractBearerToken(request: NextRequest): string | null {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    return authHeader.substring(7);
}

export async function verifyJwtAndGetUserId(token: string): Promise<string> {
    const userId = await verifyAuthToken(token);
    if (!userId) {
        throw new Error("Invalid or revoked token");
    }
    return String(userId);
}

export async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
    try {
        const token = extractBearerToken(request);
        if (!token) return null;
        return await verifyJwtAndGetUserId(token);
    } catch {
        return null;
    }
}

// 통합 인증 헬퍼: 우선순위 1) Authorization: Bearer 토큰, 2) 'auth' 쿠키(JWT)
export async function resolveUserId(request: NextRequest): Promise<number | null> {
    try {
        // 1) Authorization 헤더 우선
        const bearer = extractBearerToken(request);
        if (bearer) {
            const fromHeader = await verifyAuthToken(bearer);
            if (fromHeader) return fromHeader;
        }

        // 2) auth 또는 authorization 쿠키(JWT) — 미들웨어·레거시 클라이언트와 동일한 우선순위
        const token =
            request.cookies.get("auth")?.value || request.cookies.get("authorization")?.value || null;
        if (!token) return null;
        return await verifyAuthToken(token);
    } catch (error) {
        // 예상치 못한 에러(DB 등) 발생 시 로그만 남기고 null 반환
        console.error("[resolveUserId] 예상치 못한 에러:", error);
    }
    return null;
}

// --- 어드민 JWT 인증 ---

const ADMIN_COOKIE_NAME = "admin_auth";

export function getAdminJwtSecret(): string {
    const secret = process.env.ADMIN_JWT_SECRET;
    if (!secret) throw new Error("ADMIN_JWT_SECRET environment variable is required");
    return secret;
}

/** 어드민 JWT 토큰을 서명합니다 (로그인 시 호출). */
export function signAdminToken(): string {
    return jwt.sign({ role: "admin" }, getAdminJwtSecret(), { expiresIn: "12h" });
}

/** 요청 쿠키의 admin_auth JWT가 유효한지 검증합니다. */
/** request: NextRequest 또는 서버 컴포넌트의 cookies() — 쿠키 get만 씀 */
export function verifyAdminJwt(request: { cookies: { get(name: string): { value: string } | undefined } }): boolean {
    try {
        const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
        if (!token) return false;
        const payload = jwt.verify(token, getAdminJwtSecret()) as { role?: string };
        return payload?.role === "admin";
    } catch {
        return false;
    }
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
