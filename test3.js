const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const s = await prisma.refSkill.findMany({});
    const filtered = s.filter(x => x.name.toLowerCase().includes('mete') || x.name.toLowerCase().includes('kamik') || x.name.toLowerCase().includes('lave') || x.name.toLowerCase().includes('rifica') || x.name.toLowerCase().includes('feuillue') || x.name.toLowerCase().includes('boule'));
    console.log(filtered.map(x => x.name + ': ' + x.power));
}
main().finally(() => prisma.$disconnect());
