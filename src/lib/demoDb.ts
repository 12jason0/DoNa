// 데모용 Prisma 클라이언트 (DEMO_MODE=true 일 때만 src/lib/db.ts가 사용)
// 운영 DB에 닿지 않게 하는 장치:
//  1. 접속 주소는 DEMO_DATABASE_URL 하나만 씀. 운영 쪽 이름(DATABASE_URL·PRISMA_DATABASE_URL·DIRECT_URL)이 환경에 있으면 시작을 거부
//  2. 첫 쿼리 전에 dona_demo.marker 표시를 확인 (demo seed만 만드는 표. 운영 DB엔 없음) → 없으면 모든 쿼리 거부
//  3. 저장·수정·삭제 쿼리는 DB에 보내기 전에 막음 (DB 역할도 읽기 전용으로 두는 걸 권장: docs/DEMO.md)
import { PrismaClient } from "@prisma/client";
import { DemoBlockedError } from "./demo";
import { DEMO_GATE_INSTALLED } from "./demoBuildFlag";
import { installDemoFetchGuard } from "./demoFetchGuard";

const PROD_DB_ENV_NAMES = ["DATABASE_URL", "PRISMA_DATABASE_URL", "DIRECT_URL"] as const;

const WRITE_OPERATIONS = new Set([
    "create",
    "createMany",
    "createManyAndReturn",
    "update",
    "updateMany",
    "updateManyAndReturn",
    "upsert",
    "delete",
    "deleteMany",
    "$executeRaw",
    "$executeRawUnsafe",
    "$runCommandRaw",
]);
const WRITE_SQL = /\b(insert|update|delete|merge|truncate|drop|alter|create|grant|revoke|copy)\b/i;

function sqlText(args: unknown): string {
    if (typeof args === "string") return args;
    if (Array.isArray(args)) return typeof args[0] === "string" ? args[0] : sqlText(args[0]);
    const a = args as { sql?: unknown; strings?: unknown } | null;
    if (a && typeof a.sql === "string") return a.sql;
    if (a && Array.isArray(a.strings)) return a.strings.join(" ");
    return JSON.stringify(args ?? "");
}

function isWrite(operation: string, args: unknown) {
    if (WRITE_OPERATIONS.has(operation)) return true;
    if (operation === "$queryRaw" || operation === "$queryRawUnsafe") return WRITE_SQL.test(sqlText(args));
    return false;
}

export function demoDatabaseUrl(): string {
    const present = PROD_DB_ENV_NAMES.filter((k) => process.env[k]);
    if (present.length > 0) {
        throw new Error(`[demo] DEMO_MODE에서는 ${present.join(", ")} 를 넣으면 안 돼요. 데모 DB 주소는 DEMO_DATABASE_URL에만 넣어주세요.`);
    }
    const url = process.env.DEMO_DATABASE_URL;
    if (!url) throw new Error("[demo] DEMO_DATABASE_URL이 없어요.");
    return url;
}

let markerChecked: Promise<void> | null = null;

function ensureDemoMarker(base: PrismaClient): Promise<void> {
    markerChecked ??= base
        .$queryRawUnsafe<Array<{ ok: number }>>("SELECT 1 AS ok FROM dona_demo.marker WHERE id = 1")
        .then((rows) => {
            if (rows.length !== 1) throw new Error("marker row missing");
        })
        .catch((e) => {
            markerChecked = null; // seed를 끝낸 뒤 다시 확인할 수 있게
            throw new Error(`[demo] 데모 DB 표시(dona_demo.marker)가 없어 접속을 거부해요. npm run demo:seed 로 만든 DB인지 확인하세요. (${e instanceof Error ? e.message : e})`);
        });
    return markerChecked;
}

export function createDemoPrismaClient(): PrismaClient {
    if (!DEMO_GATE_INSTALLED) {
        throw new Error("[demo] 데모 빌드가 아니에요. 빌드 명령을 npm run build:demo 로 설정하세요 (API 저장 차단 미들웨어 포함).");
    }
    installDemoFetchGuard(); // instrumentation에서도 설치하지만, DB를 여는 서버라면 여기서 한 번 더 확실히
    const base = new PrismaClient({
        log: ["error"],
        datasources: { db: { url: demoDatabaseUrl() } },
    });
    return base.$extends({
        query: {
            async $allOperations({ model, operation, args, query }) {
                if (isWrite(operation, args)) throw new DemoBlockedError(model ? `${model}.${operation}` : operation);
                await ensureDemoMarker(base);
                return query(args);
            },
        },
    }) as unknown as PrismaClient;
}
