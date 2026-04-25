const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    await prisma.refSkill.update({ where: { name: 'Boule de Feu' }, data: { power: 7 } });
    await prisma.refSkill.update({ where: { name: 'Météores' }, data: { power: 10 } });
    await prisma.refSkill.update({ where: { name: 'Coulée de Lave' }, data: { power: 12 } });
    await prisma.refSkill.update({ where: { name: 'Kamikaze' }, data: { power: 15 } });
    await prisma.refSkill.update({ where: { name: 'Aube Feuillue' }, data: { type: 'S', power: null } });
    await prisma.refSkill.update({ where: { name: 'Pétrification' }, data: { type: 'S', power: null } });
    console.log('ok');
}
main().finally(() => prisma.$disconnect());
