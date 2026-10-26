// 데모 빌드(scripts/demo/prepare.mjs)가 true로 바꿔 씀. 이 값이 false면 API 저장 차단 미들웨어가 빠진 빌드라
// DEMO_MODE=true여도 DB를 열지 않음 (src/lib/demoDb.ts). 운영 빌드는 이 파일을 건드리지 않으므로 항상 false
export const DEMO_GATE_INSTALLED = false;
