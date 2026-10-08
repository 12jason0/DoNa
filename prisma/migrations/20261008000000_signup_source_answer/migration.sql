-- 가입 직후 질문 "두나 어디서 알게 됐어요?" 답 (instagram/search/friend/share_link/other/skipped), NULL = 아직 안 물어봄
ALTER TABLE "users" ADD COLUMN "signup_source_answer" VARCHAR(20);
