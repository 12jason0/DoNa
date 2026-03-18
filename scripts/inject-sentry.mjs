/**
 * 모든 API route.ts 파일의 catch 블록에 captureApiError를 주입하는 스크립트
 * 실행: node scripts/inject-sentry.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_DIR = path.join(__dirname, "..", "src", "app", "api");
const IMPORT_LINE = 'import { captureApiError } from "@/lib/sentry";';

function findRouteFiles(dir) {
    const results = [];
    for (const item of fs.readdirSync(dir)) {
        const full = path.join(dir, item);
        if (fs.statSync(full).isDirectory()) {
            results.push(...findRouteFiles(full));
        } else if (item === "route.ts") {
            results.push(full);
        }
    }
    return results;
}

const files = findRouteFiles(API_DIR);
let modified = 0;
let skipped = 0;

for (const file of files) {
    let content = fs.readFileSync(file, "utf-8");

    // 이미 적용된 파일 건너뜀
    if (content.includes("captureApiError")) {
        skipped++;
        continue;
    }

    // catch 블록이 없는 파일 건너뜀
    if (!content.includes("} catch")) {
        skipped++;
        continue;
    }

    // 1. import 추가: 마지막 import 행 뒤에 삽입
    const importRegex = /^import .+$/gm;
    let lastImportEnd = 0;
    let m;
    while ((m = importRegex.exec(content)) !== null) {
        lastImportEnd = m.index + m[0].length;
    }

    if (lastImportEnd > 0) {
        content =
            content.slice(0, lastImportEnd) +
            "\n" +
            IMPORT_LINE +
            content.slice(lastImportEnd);
    } else {
        content = IMPORT_LINE + "\n" + content;
    }

    // 2. catch 블록 내부 첫 줄에 captureApiError 주입
    // 매칭 패턴: (앞공백)} catch (변수명[: 타입]) {
    // 변수명만 추출해서 captureApiError(변수명) 삽입
    content = content.replace(
        /^(\s*)} catch \((\w+)(?:\s*:\s*[^)]+)?\)\s*\{$/gm,
        (match, indent, varName) => {
            return match + "\n" + indent + "        captureApiError(" + varName + ");";
        }
    );

    fs.writeFileSync(file, content, "utf-8");
    modified++;
}

console.log(`✅ 완료: ${modified}개 파일 수정, ${skipped}개 건너뜀 (총 ${files.length}개)`);
