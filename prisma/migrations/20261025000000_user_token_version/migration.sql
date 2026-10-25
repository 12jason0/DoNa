-- 로그인 토큰 무효화용 버전. JWT의 tv와 다르면 401. 로그아웃·비밀번호 변경 시 +1
ALTER TABLE "users" ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;
