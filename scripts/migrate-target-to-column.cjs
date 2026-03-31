/**
 * 1회성 데이터 이관 스크립트
 * course.tags.target (JSON) → course.target (배열 컬럼)
 *
 * 실행: node scripts/migrate-target-to-column.cjs
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    const courses = await prisma.course.findMany({
        select: { id: true, tags: true, target: true },
    });

    let updated = 0;
    let skipped = 0;

    for (const course of courses) {
        const tags = course.tags;
        if (!tags || typeof tags !== "object" || Array.isArray(tags)) {
            skipped++;
            continue;
        }

        const jsonTarget = tags.target;
        if (!Array.isArray(jsonTarget) || jsonTarget.length === 0) {
            skipped++;
            continue;
        }

        // 이미 target 컬럼에 데이터 있으면 스킵
        if (course.target && course.target.length > 0) {
            skipped++;
            continue;
        }

        await prisma.course.update({
            where: { id: course.id },
            data: { target: jsonTarget.map(String) },
        });

        console.log(`✅ course ${course.id}: target = [${jsonTarget.join(", ")}]`);
        updated++;
    }

    console.log(`\n완료: ${updated}개 이관, ${skipped}개 스킵`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
