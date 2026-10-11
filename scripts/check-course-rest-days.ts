// 코스 쉬는 날 계산 확인: npx tsx scripts/check-course-rest-days.ts
import assert from "node:assert";
import ko from "../src/i18n/messages/ko/translation.json";
import zh from "../src/i18n/messages/zh/translation.json";
import { courseRestDays, courseRestDaysLabel } from "../src/lib/courseRestDays";

const tOf = (m: any) => (key: string, p?: Record<string, string | number>) =>
    String(key.split(".").reduce((o, k) => o?.[k], m) ?? key).replace(/\{(\w+)\}/g, (_, k) => String(p?.[k] ?? ""));
const place = (...days: (number | null)[]) => ({ closed_days: days.map((d) => ({ day_of_week: d })) });

// 고정 장소: 휴무 요일 합집합, 월→일 순, 특정 날짜(day_of_week null)는 무시
const fixed = [{ segment: null, place: place(0, 2) }, { segment: null, place: place(1, null) }];
assert.deepStrictEqual(courseRestDays(fixed), [1, 2, 0]);

// 선택형: A(월·화) / B(화·수) → 둘 다 쉬는 화만
const selectable = [
    { segment: null, place: place() },
    { segment: "cafe", place: place(1, 2) },
    { segment: "cafe", place: place(2, 3) },
];
assert.deepStrictEqual(courseRestDays(selectable), [2]);

// 선택지 하나라도 매일 열면 그 구간은 쉬는 날 없음, place 없는 행은 무시
assert.deepStrictEqual(courseRestDays([{ segment: "bar", place: place(5) }, { segment: "bar", place: place() }, { segment: null, place: null }]), []);

assert.strictEqual(courseRestDaysLabel(fixed, tOf(ko)), "쉬는 날: 월·화·일");
assert.strictEqual(courseRestDaysLabel([], tOf(ko)), "매일 갈 수 있어요");
assert.strictEqual(courseRestDaysLabel(selectable, tOf(zh)), "公休日：週二");
console.log("ok");
