-- CreateTable: regions
CREATE TABLE "regions" (
    "id"            SERIAL NOT NULL,
    "name"          TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "regions_name_key" ON "regions"("name");

-- Seed: 기존 지역 데이터
INSERT INTO "regions" ("name", "display_order") VALUES
    ('성수', 1),
    ('홍대', 2),
    ('연남', 3),
    ('종로', 4),
    ('을지로', 5),
    ('강남', 6),
    ('용산', 7),
    ('이태원', 8),
    ('잠실', 9),
    ('여의도', 10),
    ('영등포', 11),
    ('한남', 12),
    ('서촌', 13),
    ('안국', 14),
    ('합정', 15),
    ('건대', 16);
