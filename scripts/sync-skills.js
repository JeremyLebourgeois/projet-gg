// scripts/sync-skills.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// --- SOURCES ---
const URL_MTS = 'https://gitlab.com/eternaltwin/dinorpg/dinorpg/-/raw/4a30477dd01753d356e1af06e829f5893ca74b96/core/src/models/dinoz/SkillList.mts';
const URL_DESC = 'https://gitlab.com/eternaltwin/dinorpg/dinorpg/-/raw/4a30477dd01753d356e1af06e829f5893ca74b96/ed-ui/src/i18n/locales/fr.json';

// --- TRADUCTIONS & MAPPINGS ---
const TYPE_MAP = {
    'SkillType.P': 'P', 'SkillType.A': 'A', 'SkillType.E': 'E', 'SkillType.U': 'U',
    'SkillType.S': 'S', 'SkillType.C': 'C', 'SkillType.M': 'M', 'SkillType.I': 'I'
};

const ELEMENT_MAP = {
    'ElementType.FIRE': 'Feu', 'ElementType.WOOD': 'Bois',
    'ElementType.WATER': 'Eau', 'ElementType.LIGHTNING': 'Foudre',
    'ElementType.AIR': 'Air', 'ElementType.VOID': 'Vide', 'ElementType.Nothing': 'Neutre'
};

const RACE_MAP = {
    'RaceEnum.CASTIVORE': 'Castivore', 'RaceEnum.FEROSS': 'Feross',
    'RaceEnum.GORILLOZ': 'Gorilloz', 'RaceEnum.KABUKI': 'Kabuki',
    'RaceEnum.MOUEFFE': 'Moueffe', 'RaceEnum.NUAGEOZ': 'Nuageoz',
    'RaceEnum.PIGMOU': 'Pigmou', 'RaceEnum.PLANALE': 'Planaille',
    'RaceEnum.PLANAILLE': 'Planaille', 'RaceEnum.QUETZU': 'Quetzu',
    'RaceEnum.ROCKY': 'Rocky', 'RaceEnum.SANTAZ': 'Santaz',
    'RaceEnum.SIRAIN': 'Sirain', 'RaceEnum.TOUFUFU': 'Toufufu',
    'RaceEnum.WANWAN': 'Wanwan', 'RaceEnum.WINKS': 'Winks',
    'RaceEnum.HIPPOCLAMP': 'Hippoclamp', 'RaceEnum.PTEROZ': 'Pteroz'
};

// --- OUTILS ---
function normalizeKey(str) {
    if (!str) return "";
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

function parseEnergy(energyCode) {
    if (!energyCode || energyCode === 'Energy.NONE') return 0;
    const num = energyCode.replace('Energy.E', '').replace('Energy.', '');
    return parseInt(num) || 0;
}

function formatPrettyName(name) {
    if (!name) return "";
    // Ajoute un espace entre minuscule et Majuscule (ex: "CanonAEau" -> "Canon A Eau")
    let pretty = name.replace(/([a-z])([A-Z])/g, '$1 $2');
    // Cas particuliers (D'...)
    pretty = pretty.replace(/\sD\s/g, " D'");
    pretty = pretty.replace(/D\sArtemis/g, "D'Artemis");
    return pretty;
}

async function syncSkills() {
    console.log("🚀 DÉMARRAGE SYNCHRO (Mode Strict - Sans Fix Manuel)...");

    try {
        // 1. TÉLÉCHARGEMENT
        console.log("📥 Téléchargement des fichiers...");
        const [mtsResp, descResp] = await Promise.all([fetch(URL_MTS), fetch(URL_DESC)]);
        const mtsText = await mtsResp.text();
        const descJson = await descResp.json();

        // 2. PRÉPARATION DES DESCRIPTIONS
        let rawDescriptions = {};
        if (descJson.skill && descJson.skill.description) {
            rawDescriptions = descJson.skill.description;
        } else if (descJson.description) {
            rawDescriptions = descJson.description;
        } else {
            rawDescriptions = descJson;
        }
        const descriptionsMap = {};
        for (const [key, value] of Object.entries(rawDescriptions)) {
            descriptionsMap[normalizeKey(key)] = value;
        }

        // 3. PRÉPARATION DE L'ENUM (Variable -> ID)
        const skillIdMap = {};
        // Regex pour trouver "NOM_CONSTANTE = 123,"
        const enumRegex = /(\w+)\s*=\s*(\d+)/g;
        let match;
        while ((match = enumRegex.exec(mtsText)) !== null) {
            skillIdMap[`Skill.${match[1]}`] = parseInt(match[2]);
        }
        console.log(`✅ ${Object.keys(skillIdMap).length} IDs trouvés dans l'enum.`);

        // 4. PARSING DES BLOCS DE COMPÉTENCES
        const skillsToUpsert = [];
        const startRegex = /\[(Skill\.\w+)\]:\s*\{/g;
        const usedNames = new Set(); // Pour gérer les doublons de noms

        while ((match = startRegex.exec(mtsText)) !== null) {
            const skillVarName = match[1]; // Ex: Skill.CANON_A_EAU
            const id = skillIdMap[skillVarName];
            
            // Si pas d'ID trouvé pour cette variable, on ignore
            if (!id) continue;

            // Isolation du bloc { ... }
            const startIndex = match.index + match[0].length - 1;
            let braceCount = 1;
            let endIndex = -1;
            for (let i = startIndex + 1; i < mtsText.length; i++) {
                if (mtsText[i] === '{') braceCount++;
                else if (mtsText[i] === '}') braceCount--;
                if (braceCount === 0) { endIndex = i; break; }
            }
            if (endIndex === -1) continue;

            const blockBody = mtsText.substring(startIndex, endIndex + 1);

            // --- EXTRACTION DES DONNÉES ---

            // A. Nom et Description
            const nameMatch = blockBody.match(/name:\s*'([^']+)'/);
            const rawName = nameMatch ? nameMatch[1] : 'Inconnu';
            
            const searchKey = normalizeKey(rawName);
            let desc = descriptionsMap[searchKey];
            if (!desc && searchKey.endsWith('s')) desc = descriptionsMap[searchKey.slice(0, -1)];
            
            // Gestion Nom Unique (Prisma @unique)
            let prettyName = formatPrettyName(rawName);
            if (usedNames.has(prettyName)) {
                // Si le nom existe déjà, on ajoute l'ID entre parenthèses
                prettyName = `${prettyName} (${id})`;
            }
            usedNames.add(prettyName);

            // B. Type et Élément
            const typeMatch = blockBody.match(/type:\s*(SkillType\.\w+)/);
            let type = typeMatch ? TYPE_MAP[typeMatch[1]] : 'P';
            
            const elemMatch = blockBody.match(/element:\s*\[(.*?)\]/);
            let elementStr = elemMatch ? elemMatch[1] : '';
            
            let finalElement = 'Neutre';
            if (elementStr.includes('VOID')) {
                finalElement = 'Vide';
            } else {
                let foundElements = [];
                for (const [code, label] of Object.entries(ELEMENT_MAP)) {
                    if (elementStr.includes(code)) foundElements.push(label);
                }
                if (foundElements.length > 1) finalElement = 'Double';
                else if (foundElements.length === 1) finalElement = foundElements[0];
            }

            // C. Stats
            const probMatch = blockBody.match(/probability:\s*(\d+)/);
            const prob = probMatch ? parseInt(probMatch[1]) : 0;
            const prioMatch = blockBody.match(/priority:\s*(\d+)/);
            const prio = prioMatch ? parseInt(prioMatch[1]) : 0;
            const energyMatch = blockBody.match(/energy:\s*(Energy\.\w+)/);
            const energyRaw = energyMatch ? energyMatch[1] : 'Energy.NONE';
            const energy = parseEnergy(energyRaw);

            // D. Nature (Logique stricte sans manual fix)
            const sphereMatch = blockBody.match(/isSphereSkill:\s*(true|false)/);
            const isSphere = sphereMatch && sphereMatch[1] === 'true';
            
            const treeMatch = blockBody.match(/tree:\s*(SkillTreeType\.\w+)/);
            const treeType = treeMatch ? treeMatch[1] : 'SkillTreeType.VANILLA';

            let nature = 1; // Défaut
            if (isSphere) {
                nature = 3; // C'est une sphère
            } else if (treeType === 'SkillTreeType.ETHER') {
                nature = 2; // C'est l'arbre 2 (New tree / Level 50+)
            }

            // E. Race
            const raceMatch = blockBody.match(/race:\s*(RaceEnum\.\w+)/);
            let raceId = null;
            if (raceMatch && raceMatch[1]) raceId = RACE_MAP[raceMatch[1]] || null;

            // F. Parents (UnlockedFrom)
            const parentMatch = blockBody.match(/unlockedFrom:\s*\[([\s\S]*?)\]/);
            let parentIds = [];
            
            if (parentMatch && parentMatch[1].trim() !== '') {
                // On récupère "Skill.ABC, 123, Skill.DEF"
                const parentsRaw = parentMatch[1].split(',').map(s => s.trim());
                
                parentsRaw.forEach(p => {
                    if (!p) return;

                    // CAS 1 : C'est une constante (ex: Skill.CANON)
                    if (skillIdMap[p]) {
                        parentIds.push(skillIdMap[p]);
                    } 
                    // CAS 2 : C'est un ID brut numérique (ex: 12)
                    // On vérifie si c'est un nombre valide
                    else if (!isNaN(p) && parseInt(p) > 0) {
                        parentIds.push(parseInt(p));
                    }
                });
            }

            // --- AJOUT À LA LISTE ---
            skillsToUpsert.push({
                data: {
                    id, 
                    name: prettyName, 
                    type: type || 'P', 
                    element: finalElement,
                    description: desc || "Description indisponible",
                    skillNature: nature, 
                    energy, 
                    probability: prob, 
                    priority: prio, 
                    raceId
                },
                parentIds: parentIds
            });
        }

        console.log(`✅ Parsing terminé. ${skillsToUpsert.length} compétences prêtes à l'envoi.`);

        // 5. INSERTION EN BASE DE DONNÉES (2 Passes)
        if (skillsToUpsert.length > 0) {
            
            // PASSE 1 : Créer les compétences (sans liens pour éviter erreurs de clé étrangère)
            console.log("💾 1/2 : Enregistrement des compétences...");
            let count = 0;
            // On utilise une boucle série pour éviter de surcharger SQLite/Postgres
            for (const item of skillsToUpsert) {
                await prisma.refSkill.upsert({
                    where: { id: item.data.id },
                    update: item.data,
                    create: item.data
                });
                count++;
                if (count % 50 === 0) process.stdout.write('.'); // Barre de progression
            }
            console.log(`\n✅ ${count} compétences insérées/mises à jour.`);

            // PASSE 2 : Créer les liens Parents -> Enfants
            console.log("🔗 2/2 : Tissage des liens (Arbres)...");
            for (const item of skillsToUpsert) {
                // On vide d'abord les parents existants pour éviter les doublons si on relance le script
                // (Astuce : on set: [] ne marche pas toujours en update direct, mais set: [...] remplace tout)
                
                if (item.parentIds.length > 0) {
                    await prisma.refSkill.update({
                        where: { id: item.data.id },
                        data: {
                            parents: {
                                set: item.parentIds.map(pid => ({ id: pid }))
                            }
                        }
                    });
                } else {
                     // Si pas de parents, on s'assure qu'il n'y en a pas en base (Cas racine)
                     await prisma.refSkill.update({
                        where: { id: item.data.id },
                        data: { parents: { set: [] } }
                    });
                }
            }
            console.log(`🎉 OPÉRATION TERMINÉE AVEC SUCCÈS !`);
        } else {
            console.warn("⚠️ Aucune compétence trouvée. Vérifiez les URLs.");
        }

    } catch (err) {
        console.error("❌ ERREUR CRITIQUE :", err);
    } finally {
        await prisma.$disconnect();
    }
}

// Lancer le script
syncSkills();