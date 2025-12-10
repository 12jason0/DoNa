import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000; // UTC+9

function startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

// KST(UTC+9) 기준 자정
function startOfDayKST(date: Date): Date {
    const ms = date.getTime() + KST_OFFSET_MS; // KST로 보정
    const kst = new Date(ms);
    const y = kst.getUTCFullYear();
    const m = kst.getUTCMonth();
    const d = kst.getUTCDate();
    // 해당 KST 날짜의 00:00을 UTC 기준 밀리초로 만든 뒤 다시 UTC-9h로 되돌려 실제 Date 생성
    const startUtcMs = Date.UTC(y, m, d);
    return new Date(startUtcMs - KST_OFFSET_MS);
}

function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isSameDayKST(a: Date, b: Date): boolean {
    return startOfDayKST(a).getTime() === startOfDayKST(b).getTime();
}

function startOfWeekMonday(date: Date): Date {
    const d = startOfDay(date);
    const day = d.getDay(); // 0=Sun,1=Mon,...
    const mondayOffset = (day + 6) % 7;
    d.setDate(d.getDate() - mondayOffset);
    return d;
}

// 기준(anchor) 날짜(보통 '오늘' 또는 '어제')을 포함하여 역방향으로 연속 출석을 계산
function computeConsecutiveStreakUpTo(sortedDescCheckins: { date: Date }[], anchorDate: Date): number {
	if (sortedDescCheckins.length === 0) return 0;
	let streak = 0;
	let expected = startOfDayKST(anchorDate);
	for (const c of sortedDescCheckins) {
		const day = startOfDayKST(new Date(c.date));
		if (isSameDayKST(day, expected)) {
			streak += 1;
			expected = new Date(expected);
			expected.setDate(expected.getDate() - 1);
			continue;
		}
		// 첫 불일치가 나오는 즉시 종료 (중간에 빈 날이 있으면 연속 끊김)
		// day가 expected보다 이전이면 더 이상 연속 아님
		if (day < expected) break;
	}
	return streak;
}

// 보상(award)된 날을 기준으로 다음날부터 스트릭을 1부터 다시 시작
function computeEffectiveStreakUpTo(
	sortedDescCheckins: { date: Date; rewarded?: boolean }[],
	anchorDate: Date
): number {
	const lastRewarded = sortedDescCheckins.find((c) => c.rewarded === true);
	if (!lastRewarded) {
		return computeConsecutiveStreakUpTo(sortedDescCheckins, anchorDate);
	}
	const anchorStart = startOfDayKST(anchorDate);
	// 보상일이 앵커일과 동일하면 7개 달성 상태로 취급
	if (isSameDayKST(startOfDayKST(new Date(lastRewarded.date)), anchorStart)) {
		return 7;
	}
	// 보상일 이후부터 다시 1부터 연속 계산
	const cutoff = startOfDayKST(new Date(lastRewarded.date));
	const filtered = sortedDescCheckins.filter((c) => startOfDayKST(new Date(c.date)) > cutoff);
	return computeConsecutiveStreakUpTo(filtered, anchorDate);
}

// 보상일 기반 7칸 사이클 도장 배열 생성
function buildCycleStamps(
	sortedDescCheckins: { date: Date; rewarded?: boolean }[],
	now: Date,
	todayChecked: boolean
): { stamps: boolean[]; todayIndex: number | null } {
	const todayStart = startOfDayKST(now);
	const lastRewarded = sortedDescCheckins.find((c) => c.rewarded === true);

	// 앵커: 오늘이 찍혀 있지 않다면 '어제'를 기준으로 연속계산/표시 영역을 잡는다
	const anchor = new Date(todayStart);
	if (!todayChecked) {
		anchor.setDate(anchor.getDate() - 1);
	}

	// 현재 유효 스트릭 계산 (연속성이 끊겼는지 확인하기 위함)
	const effective = computeEffectiveStreakUpTo(sortedDescCheckins, anchor);

	let cycleStart: Date;
	let useRewardCycle = false;

	if (lastRewarded) {
		const rewardedDay = startOfDayKST(new Date(lastRewarded.date));
		// 1. 보상 받은 날이 앵커(오늘/어제)인 경우 -> 꽉 찬 7개 보여줌
		if (isSameDayKST(rewardedDay, startOfDayKST(anchor))) {
			useRewardCycle = true;
		} else {
			// 2. 보상 이후 진행 중인 경우 -> 연속성이 유지되고 있는지 확인
			const expectedStart = new Date(rewardedDay);
			expectedStart.setDate(expectedStart.getDate() + 1);

			// 스트릭으로 역산한 시작일
			// effective가 1이면 anchor와 동일, 2이면 anchor-1...
			const streakStart = new Date(anchor);
			streakStart.setDate(streakStart.getDate() - Math.max(0, effective - 1));

			// 스트릭 시작일이 보상 다음날보다 늦으면 -> 중간에 끊긴 것임 -> 리셋 로직(else) 사용
			// 스트릭 시작일이 보상 다음날과 같거나 빠르면 -> 연속 유지 중 -> 보상 사이클 유지
			if (streakStart.getTime() <= expectedStart.getTime()) {
				useRewardCycle = true;
			}
		}
	}

	if (useRewardCycle && lastRewarded) {
		const rewardedDay = startOfDayKST(new Date(lastRewarded.date));
		if (isSameDayKST(rewardedDay, startOfDayKST(anchor))) {
			cycleStart = new Date(anchor);
			cycleStart.setDate(cycleStart.getDate() - 6);
		} else {
			// 보상 다음날부터 1칸부터 시작
			cycleStart = new Date(rewardedDay);
			cycleStart.setDate(cycleStart.getDate() + 1);
		}
	} else {
		// 보상 이력 없거나, 중간에 끊겨서 새로 시작해야 하는 경우
		cycleStart = new Date(anchor);
		cycleStart.setDate(cycleStart.getDate() - Math.max(0, effective - 1));
	}

	const dayKey = (d: Date) => {
		const sd = startOfDayKST(d);
		const y = sd.getUTCFullYear();
		const m = String(sd.getUTCMonth() + 1).padStart(2, "0");
		const day = String(sd.getUTCDate()).padStart(2, "0");
		return `${y}-${m}-${day}`;
	};
	const checkedDaySet = new Set(sortedDescCheckins.map((c) => dayKey(new Date(c.date))));
	const todayKey = dayKey(todayStart);

	let todayIndex: number | null = null;
	const stamps = Array.from({ length: 7 }, (_, i) => {
		const dt = new Date(cycleStart);
		dt.setDate(cycleStart.getDate() + i);
		const dtKey = dayKey(dt);
		if (dtKey === todayKey) {
			todayIndex = i;
		}
		return checkedDaySet.has(dtKey);
	});

	return { stamps, todayIndex };
}

export async function GET(request: NextRequest) {
    try {
        const userId = resolveUserId(request);
        if (!userId) return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
        if (!Number.isFinite(userId)) return NextResponse.json({ success: false, error: "BAD_USER" }, { status: 400 });

        const checkins = await (prisma as any).userCheckin.findMany({
            where: { userId },
            orderBy: { date: "desc" },
            take: 120,
        });

        const now = new Date();
        // 오늘 출석 여부 및 오늘 제외한 과거 도장 배열 생성
        const todayStart = startOfDayKST(new Date(now));
        const todayEnd = new Date(todayStart);
        todayEnd.setDate(todayEnd.getDate() + 1);
        const todayChecked = checkins.some((c: { date: Date }) => {
            const d = new Date(c.date);
            return d >= todayStart && d < todayEnd;
        });

        // 유효 스트릭 계산
        // 오늘 미체크 시에는 '어제'를 기준으로 연속일을 계산하여 프리마킹에 활용
        const anchorForStreak = new Date(todayStart);
        if (!todayChecked) anchorForStreak.setDate(anchorForStreak.getDate() - 1);
        const streak = computeEffectiveStreakUpTo(checkins, anchorForStreak);

        // 실제 출석 날짜를 기반으로 올바른 배열 생성
        const { stamps: weekStamps, todayIndex } = buildCycleStamps(checkins, now, todayChecked);
        // 주간 진행도(0~7)
        const weekCount = Math.min(7, Math.max(0, streak));

        return NextResponse.json({ success: true, checkins, streak, todayChecked, weekCount, weekStamps, todayIndex });
    } catch (e) {
        return NextResponse.json({ success: false, error: "SERVER_ERROR" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const userId = resolveUserId(request);
        if (!userId) return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
        if (!Number.isFinite(userId)) return NextResponse.json({ success: false, error: "BAD_USER" }, { status: 400 });

        const now = new Date();
        const start = startOfDayKST(now);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);

        const existing = await (prisma as any).userCheckin.findFirst({
            where: { userId, date: { gte: start, lt: end } },
        });
        if (existing) {
            // 이미 오늘 체크한 경우에도 최신 스트릭을 계산하여 반환
            const recent = await (prisma as any).userCheckin.findMany({
                where: { userId },
                orderBy: { date: "desc" },
                take: 120,
            });
            const streak = computeEffectiveStreakUpTo(recent, now);
            const { stamps: weekStamps, todayIndex } = buildCycleStamps(recent, now, true);
            const weekCount = Math.min(7, Math.max(0, streak));
            return NextResponse.json({
                success: true,
                alreadyChecked: true,
                awarded: existing.rewarded,
                streak,
                weekStamps,
                weekCount,
                todayIndex,
            });
        }

        const created = await (prisma as any).userCheckin.create({ data: { userId, date: now, rewarded: false } });

        // 연속 출석 스트릭 및 사이클 카운트 계산 (오늘 방금 체크 포함)
        const recent = await (prisma as any).userCheckin.findMany({
            where: { userId },
            orderBy: { date: "desc" },
            take: 120,
        });
        const effectiveStreak = computeEffectiveStreakUpTo(recent, now);
        // 실제 출석 날짜를 기반으로 올바른 배열 생성 (오늘 포함)
        const { stamps: weekStamps, todayIndex } = buildCycleStamps(recent, now, true);
        const weekCount = Math.min(7, Math.max(0, effectiveStreak));
        const todayStart = startOfDayKST(now);
        const hasRewardedToday = recent.some(
            (c: { date: Date; rewarded?: boolean }) => c.rewarded === true && isSameDayKST(new Date(c.date), todayStart)
        );

        let awarded = false;
        // 7개 달성 시 쿠폰 2개 지급 — 당일 중복 보상 방지
        if (effectiveStreak === 7 && !hasRewardedToday) {
            await (prisma as any).$transaction([
                // 쿠폰 보상 기록 (2개)
                (prisma as any).userReward.create({
                    data: { userId, type: "checkin", amount: 2, unit: "coupon" as any },
                }),
                // 유저 데이터 업데이트 (쿠폰 2)
                (prisma as any).user.update({
                    where: { id: userId },
                    data: {
                        couponCount: { increment: 2 },
                    },
                }),
                // 체크인 보상 완료 표시
                (prisma as any).userCheckin.update({ where: { id: created.id }, data: { rewarded: true } }),
            ]);
            awarded = true;
        }

        return NextResponse.json({
            success: true,
            alreadyChecked: false,
            awarded,
            streak: effectiveStreak,
            weekCount,
            weekStamps,
            todayIndex,
            rewardAmount: awarded ? 2 : 0,
        });
    } catch (e) {
        return NextResponse.json({ success: false, error: "SERVER_ERROR" }, { status: 500 });
    }
}
