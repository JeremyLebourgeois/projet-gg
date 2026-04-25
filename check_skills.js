const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const skills = await prisma.refSkill.findMany({});
    const filtered = skills.filter(s => 
        s.name.toLowerCase().includes('printemps')
    );
    console.log(JSON.stringify(filtered.map(s => ({ id: s.id, name: s.name, modifiers: s.modifiers })), null, 2));
}

check().catch(console.error).finally(() => prisma.$disconnect());
