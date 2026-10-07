import type { Prisma } from "@prisma/client";

/**
 * 코스 완료 기록 (같은 코스는 한 번만). '다녀왔어요'와 나만의 추억 저장이 같이 씀.
 * @returns 새로 기록했으면 true
 */
export async function recordCourseCompletion(
    tx: Prisma.TransactionClient,
    userId: number,
    courseId: number,
): Promise<boolean> {
    const existing = await tx.completedCourse.findFirst({ where: { userId, courseId }, select: { id: true } });
    if (existing) return false;
    await tx.completedCourse.create({ data: { userId, courseId } });
    await (tx as any).userInteraction.create({ data: { userId, courseId, action: "complete" } });
    return true;
}
