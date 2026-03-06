const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    const s = await prisma.refSkill.findUnique({ where: { name: 'Esquive' } });
    console.log(s.name, s.modifiers);
}
run().finally(() => prisma.$disconnect());
