import { PrismaClient } from "@prisma/client";
import { logger } from "./logger";

// Prisma 클라이언트 싱글톤 (HMR 대응)
declare global {
    // eslint-disable-next-line no-var
    var __prisma: PrismaClient | undefined;
}

// ✅ PRISMA_DATABASE_URL (Accelerate)를 우선 사용
const databaseUrl = process.env.PRISMA_DATABASE_URL || process.env.DATABASE_URL;

// 🟢 [Fix]: 연결 풀 설정 추가 (아이패드 연결 풀 타임아웃 문제 해결)
function getDatabaseUrlWithPoolConfig(url: string | undefined): string {
    if (!url) return "";
    
    // 이미 연결 파라미터가 있는지 확인
    const hasParams = url.includes("?");
    
    if (hasParams) {
        // 기존 파라미터가 있으면 추가
        const urlObj = new URL(url);
        urlObj.searchParams.set("connection_limit", "5");
        urlObj.searchParams.set("pool_timeout", "30"); // 🟢 Cold start 대응: 30초
        urlObj.searchParams.set("connect_timeout", "15"); // 🟢 첫 연결 지연 대응: 15초
        return urlObj.toString();
    } else {
        // 파라미터가 없으면 추가
        return `${url}?connection_limit=5&pool_timeout=30&connect_timeout=15`;
    }
}

export const prisma: PrismaClient =
    global.__prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === "production" ? ["error"] : ["query", "error", "warn"],
        datasources: {
            db: {
                url: getDatabaseUrlWithPoolConfig(databaseUrl),
            },
        },
    });

if (!global.__prisma) {
    global.__prisma = prisma;
}

// 연결 확인 (빌드 시에는 건너뛰기)
// Next.js 빌드 중에는 데이터베이스 연결을 시도하지 않음
const isBuildTime =
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.NEXT_PHASE === "phase-development-build" ||
    (typeof window === "undefined" && process.argv.includes("build"));

export default prisma;
