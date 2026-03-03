const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const skills = await prisma.refSkill.findMany({
        where: {
            name: { contains: 'Furtivit' }
        },
        select: { name: true, modifiers: true }
    });
    console.log(JSON.stringify(skills, null, 2));
    await prisma.$disconnect();
}
run();
