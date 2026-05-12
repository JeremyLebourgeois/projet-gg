const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
    const passHash = await bcrypt.hash('altousJL_356', 10);
    await prisma.user.update({
        where: { pseudo: 'Jerem' },
        data: { passwordHash: passHash }
    });
    console.log("Password for Jerem updated to altousJL_356!");
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
