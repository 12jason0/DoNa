import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://neondb_owner:npg_62UYhDKMQfRg@ep-delicate-grass-a1m6bmdg.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' } }
});
const rows = await prisma.courseUnlock.findMany({
  orderBy: { unlockedAt: 'desc' },
  take: 10,
  include: {
    user: { select: { id: true, email: true } },
    course: { select: { id: true, title: true } }
  }
});
console.log(JSON.stringify(rows, null, 2));
await prisma.$disconnect();
