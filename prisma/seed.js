const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
    console.log(`🌱 Démarrage du seed...`);

    // 1. Localiser le fichier competences.json
    // On suppose qu'il est à la racine du projet (un étage plus haut que ce dossier prisma/)
    const jsonPath = path.resolve(__dirname, '..', 'skills\\competences.json');
    
    if (!fs.existsSync(jsonPath)) {
        console.error("❌ ERREUR : Le fichier 'competences.json' est introuvable à la racine !");
        console.error("👉 Lance d'abord la commande : node convert-skills.js");
        return;
    }

    const skillsData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    console.log(`📦 ${skillsData.length} compétences chargées depuis le fichier JSON.`);

    // 2. Insérer/Mettre à jour les compétences (PASS 1 : Les Données)
    console.log("📝 Insertion des données brutes...");
    
    for (const skill of skillsData) {
        await prisma.refSkill.upsert({
            where: { id: skill.id },
            update: {
                name: skill.name,
                type: skill.type,
                element: skill.element,
                description: skill.description,
                energy: skill.energy,
                probability: skill.probability,
                priority: skill.priority,
                skillNature: skill.skillNature,
                raceId: skill.raceId
            },
            create: {
                id: skill.id,
                name: skill.name,
                type: skill.type,
                element: skill.element,
                description: skill.description,
                energy: skill.energy,
                probability: skill.probability,
                priority: skill.priority,
                skillNature: skill.skillNature,
                raceId: skill.raceId
            }
        });
    }
    console.log("✅ Données insérées.");

    // 3. Connecter les Parents (PASS 2 : Les Relations)
    console.log("🔗 Construction de l'arbre d'évolution...");
    
    let relationsCount = 0;
    for (const skill of skillsData) {
        if (skill.parents && skill.parents.length > 0) {
            
            // On filtre pour ne garder que les parents qui existent réellement dans notre import
            // (Pour éviter que Prisma ne plante si un parent a été filtré car sans description)
            const validParents = skill.parents
                .filter(pid => skillsData.find(s => s.id === pid))
                .map(pid => ({ id: pid }));

            if (validParents.length > 0) {
                await prisma.refSkill.update({
                    where: { id: skill.id },
                    data: {
                        parents: {
                            set: validParents // 'set' remplace les liens existants (évite les doublons)
                        }
                    }
                });
                relationsCount++;
            }
        }
    }

    console.log(`🎉 SUCCÈS : Base de données remplie avec ${skillsData.length} compétences et ${relationsCount} liaisons d'arbre !`);
}

main()
    .catch((e) => {
        console.error("❌ Une erreur est survenue :", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });