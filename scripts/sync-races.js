const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// URLs Officielles
const URL_SKILL_LIST = "https://gitlab.com/eternaltwin/dinorpg/dinorpg/-/raw/develop/core/src/models/dinoz/SkillList.mts";
const URL_RACE_LIST = "https://gitlab.com/eternaltwin/dinorpg/dinorpg/-/raw/develop/core/src/models/dinoz/RaceList.mts";

async function syncRace() {
    console.log("🔗 Synchronisation via IDs (Méthode robuste)...");

    try {
        // ============================================================
        // ÉTAPE 1 : RÉCUPÉRER LES IDs DES SKILLS
        // ============================================================
        console.log("📥 Analyse de SkillList pour récupérer les IDs...");
        const resSkill = await fetch(URL_SKILL_LIST);
        if (!resSkill.ok) throw new Error("Erreur accès SkillList");
        const skillText = await resSkill.text();

        // On va construire une map : { "FORCE_DE_LUMIERE": 14301, "COQUE": 1001 ... }
        const enumToIdMap = {};

        // 1. On cherche le bloc "export enum Skill { ... }"
        const enumBlockMatch = skillText.match(/export enum Skill \{([\s\S]*?)\}/);
        
        if (enumBlockMatch) {
            const enumContent = enumBlockMatch[1];
            // 2. On capture chaque ligne : MOT_CLE = 12345,
            const lineRegex = /(\w+)\s*=\s*(\d+)/g;
            let match;
            while ((match = lineRegex.exec(enumContent)) !== null) {
                const codeEnum = match[1]; // ex: FORCE_DE_LUMIERE
                const id = parseInt(match[2]); // ex: 14301
                enumToIdMap[codeEnum] = id;
            }
        }
        
        console.log(`✅ Dictionnaire d'IDs construit : ${Object.keys(enumToIdMap).length} IDs trouvés.`);


        // ============================================================
        // ÉTAPE 2 : TRAITER LES RACES
        // ============================================================
        console.log("📥 Analyse de RaceList...");
        const resRace = await fetch(URL_RACE_LIST);
        if (!resRace.ok) throw new Error("Erreur accès RaceList");
        const raceText = await resRace.text();

        const raceBlockRegex = /\[RaceEnum\.(\w+)\]:\s*\{([\s\S]*?)\n\t\},/g;
        let match;
        let processed = 0;

        while ((match = raceBlockRegex.exec(raceText)) !== null) {
            const enumRace = match[1]; 
            const content = match[2]; 

            // --- Données Race ---
            const nameMatch = content.match(/name:\s*'([^']+)'/);
            let rawName = nameMatch ? nameMatch[1] : enumRace.toLowerCase();
            let displayName = rawName.replace(/_/g, ' ');
            displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);

            const isDemonMatch = content.match(/isDemon:\s*(true|false)/);
            const isDemon = isDemonMatch ? isDemonMatch[1] === 'true' : false;
            
            const priceMatch = content.match(/price:\s*(\d+)/);
            const price = priceMatch ? parseInt(priceMatch[1]) : 0;

            // Stats
            const nbrFire = extractValue(content, 'nbrFire');
            const nbrWood = extractValue(content, 'nbrWood');
            const nbrWater = extractValue(content, 'nbrWater');
            const nbrBolt = extractValue(content, 'nbrLightning'); 
            const nbrAir = extractValue(content, 'nbrAir');

            const upChanceBlockMatch = content.match(/upChance:\s*\{([^}]+)\}/);
            let upFire=0, upWood=0, upWater=0, upBolt=0, upAir=0;
            if (upChanceBlockMatch) {
                const upContent = upChanceBlockMatch[1];
                upFire = extractValue(upContent, 'fire');
                upWood = extractValue(upContent, 'wood');
                upWater = extractValue(upContent, 'water');
                upBolt = extractValue(upContent, 'lightning');
                upAir = extractValue(upContent, 'air');
            }

            // --- LIAISON COMPÉTENCE PAR ID ---
            let skillId = null;
            // On cherche : skillId: [Skill.CODE]
            const skillLinkMatch = content.match(/skillId:\s*\[Skill\.(\w+)\]/);

            if (skillLinkMatch) {
                const skillCodeEnum = skillLinkMatch[1]; // Ex: FORCE_DE_LUMIERE
                
                // On récupère l'ID numérique depuis notre map
                const targetId = enumToIdMap[skillCodeEnum];

                if (targetId) {
                    // Vérification : est-ce que cet ID existe vraiment dans TA base ?
                    // (Normalement oui, si tu as importé tes skills correctement)
                    const skillInDb = await prisma.refSkill.findUnique({ where: { id: targetId } });
                    
                    if (skillInDb) {
                        skillId = targetId;
                        // console.log(`   + Skill OK pour ${displayName} : ID ${targetId} (${skillInDb.name})`);
                    } else {
                        console.warn(`   ⚠️ L'ID ${targetId} (${skillCodeEnum}) est demandé par ${displayName} mais n'existe pas dans ta table RefSkill.`);
                    }
                } else {
                    console.warn(`   ⚠️ Code Enum "${skillCodeEnum}" inconnu dans SkillList.`);
                }
            }

            // --- Sauvegarde ---
            await prisma.refRace.upsert({
                where: { name: displayName },
                update: {
                    isDemon, price,
                    baseFire: nbrFire, baseWood: nbrWood, baseWater: nbrWater, baseBolt: nbrBolt, baseAir: nbrAir,
                    upFire, upWood, upWater, upBolt, upAir,
                    innateSkillId: skillId
                },
                create: {
                    name: displayName,
                    isDemon, price,
                    baseFire: nbrFire, baseWood: nbrWood, baseWater: nbrWater, baseBolt: nbrBolt, baseAir: nbrAir,
                    upFire, upWood, upWater, upBolt, upAir,
                    innateSkillId: skillId
                }
            });
            processed++;
        }

        console.log(`🎉 Terminé ! ${processed} races synchronisées avec succès.`);

    } catch (error) {
        console.error("❌ Erreur critique :", error);
    } finally {
        await prisma.$disconnect();
    }
}

function extractValue(text, key) {
    const regex = new RegExp(`${key}:\\s*(\\d+)`);
    const match = text.match(regex);
    return match ? parseInt(match[1]) : 0;
}

syncRace();