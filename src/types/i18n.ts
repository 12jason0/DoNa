// src/types/i18n.ts
// translation.json의 재귀적 키 구조를 TypeScript 타입으로 추출하여 t() 자동완성·타입 검사 적용

import ko from "@/i18n/messages/ko/translation.json";

export type NestedKeyOf<ObjectType extends object> = {
    [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
        ? `${Key}` | `${Key}.${NestedKeyOf<ObjectType[Key]>}`
        : `${Key}`;
}[keyof ObjectType & (string | number)];

export type TranslationKeys = NestedKeyOf<typeof ko>;
