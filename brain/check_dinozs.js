const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findUnique({ where: { pseudo: 'Jerem' }, include: { dinozs: true } });
    if (!user) {
        console.log("User Jerem not found!");
        return;
    }
    console.log("Dinozs for Jerem:", user.dinozs.map(d => ({ id: d.id, name: d.name })));
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
