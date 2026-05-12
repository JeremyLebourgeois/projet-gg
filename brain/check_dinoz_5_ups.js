const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const dino = await prisma.dinoz.findUnique({ where: { id: 5 } });
    if (!dino) {
        console.log("Dinoz 5 not found!");
        return;
    }
    console.log("Ups for Dinoz 5:", dino.ups);
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
