/**
 * courses.tags.target(배열) 값을 기준으로
 * target_situation / target_audience 를 일괄 백필합니다.
 *
 * 실행:
 *   node scripts/backfill-course-target-from-tags.cjs
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function pickTargetFromTags(tags) {
    if (!tags || typeof tags !== "object") return "";
    const target = tags.target;
    if (!Array.isArray(target)) return "";
    return target.map((v) => String(v).trim()).filter(Boolean).join(", ");
}

async function main() {
    const courses = await prisma.course.findMany({
        select: {
            id: true,
            tags: true,
            target_situation: true,
            target_audience: true,
        },
    });

    let updated = 0;
    for (const course of courses) {
        const nextTarget = pickTargetFromTags(course.tags);
        if (!nextTarget) continue;

        const currentSituation = String(course.target_situation || "").trim();
        const currentAudience = String(course.target_audience || "").trim();
        if (currentSituation === nextTarget && currentAudience === nextTarget) continue;

        await prisma.course.update({
            where: { id: course.id },
            data: {
                target_situation: nextTarget,
                target_audience: nextTarget,
            },
        });
        updated += 1;
        console.log(`[course ${course.id}] target backfilled -> ${nextTarget}`);
    }

    console.log(`Done. updated courses: ${updated}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
