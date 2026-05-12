const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({ select: { pseudo: true } });
    console.log("Users in DB:", users);
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
