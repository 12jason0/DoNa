/**
 * export-empty-tips.js
 * 팁이 비어있는 장소들을 지역별로 조회해서 JSON으로 출력합니다.
 *
 * 실행: node scripts/export-empty-tips.js [지역명]
 * 예시: node scripts/export-empty-tips.js 용산
 *       node scripts/export-empty-tips.js   (전체 조회)
 */

require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");
const fs = require("fs");

const region = process.argv[2] || null;

async function main() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log("✅ DB 연결 완료\n");

  // 지역별 현황 먼저 출력
  const statsRes = await client.query(`
    SELECT
      c.region,
      COUNT(DISTINCT cp.id) AS total,
      COUNT(DISTINCT CASE WHEN (cp.tips IS NULL OR cp.tips = '' OR cp.tips = 'null') THEN cp.id END) AS empty
    FROM course_places cp
    JOIN courses c ON cp.course_id = c.id
    GROUP BY c.region
    ORDER BY empty DESC
  `);

  console.log("📊 지역별 팁 현황:");
  console.log("─".repeat(40));
  statsRes.rows.forEach((r) => {
    const bar = "█".repeat(Math.round((r.empty / r.total) * 10));
    console.log(`${(r.region || "미지정").padEnd(15)} 전체: ${String(r.total).padStart(3)} | 비어있음: ${String(r.empty).padStart(3)} ${bar}`);
  });
  console.log("─".repeat(40));
  console.log();

  // 팁 없는 장소 조회
  const whereClause = region
    ? `AND c.region ILIKE $1`
    : "";
  const queryParams = region ? [`%${region}%`] : [];

  const res = await client.query(
    `
    SELECT
      c.id AS course_id,
      c.title AS course_title,
      c.region,
      c.grade,
      cp.id AS course_place_id,
      cp.order_index,
      cp.segment,
      cp.tips,
      p.id AS place_id,
      p.name AS place_name,
      p.address,
      p.category,
      p.avg_cost_range,
      p.opening_hours,
      p.parking_available
    FROM course_places cp
    JOIN courses c ON cp.course_id = c.id
    JOIN places p ON cp.place_id = p.id
    WHERE (cp.tips IS NULL OR cp.tips = '' OR cp.tips = 'null')
    ${whereClause}
    ORDER BY c.region, c.id, cp.order_index
    `,
    queryParams
  );

  console.log(`🔍 ${region ? `[${region}] ` : ""}팁 없는 장소: ${res.rows.length}개\n`);

  // JSON 파일로 저장
  const outputData = {
    exportedAt: new Date().toISOString(),
    region: region || "전체",
    total: res.rows.length,
    places: res.rows.map((r) => ({
      course_place_id: r.course_place_id,
      place_id: r.place_id,
      place_name: r.place_name,
      address: r.address || "",
      category: r.category || "",
      avg_cost_range: r.avg_cost_range || "",
      opening_hours: r.opening_hours || "",
      parking_available: r.parking_available,
      course_id: r.course_id,
      course_title: r.course_title,
      region: r.region,
      grade: r.grade,
      order_index: r.order_index,
      segment: r.segment || null,
      // 팁 초안 (아래 import-tips.js에서 채워넣을 부분)
      tips_draft: [],
    })),
  };

  const filename = `scripts/empty-tips-${region || "all"}-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(outputData, null, 2), "utf8");

  console.log(`💾 저장 완료: ${filename}`);
  console.log("\n장소 목록:");
  res.rows.forEach((r, i) => {
    console.log(`  ${String(i + 1).padStart(3)}. [${r.region}] ${r.course_title} > ${r.place_name} (${r.category || "카테고리없음"})`);
  });

  await client.end();
}

main().catch((e) => {
  console.error("❌ 오류:", e.message);
  process.exit(1);
});
