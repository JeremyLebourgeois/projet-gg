const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
    await prisma.refSkill.update({
        where: { id: 31301 },
        data: {
            modifiers: {
                "FIRE_DEFENSE": 25
            }
        }
    });
    console.log("Fixed Zero Absolu");
}

fix().catch(console.error).finally(() => prisma.$disconnect());
