/** 제휴·광고 문의 (/partner) 공통 라벨. 키는 DB CHECK 제약(add_partner_inquiries.sql)과 같아야 함 */
export const INQUIRY_TYPES = { popup: "팝업 노출", place: "장소 제휴", ad: "광고", etc: "기타" } as const;
export type InquiryType = keyof typeof INQUIRY_TYPES;

export const INQUIRY_STATUSES = { new: "신규", contacted: "연락함", done: "완료" } as const;
export type InquiryStatus = keyof typeof INQUIRY_STATUSES;
