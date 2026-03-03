// scripts/sync-skills.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// --- SOURCES ---
const URL_MTS = 'https://gitlab.com/eternaltwin/dinorpg/dinorpg/-/raw/4a30477dd01753d356e1af06e829f5893ca74b96/core/src/models/dinoz/SkillList.mts';
const URL_DESC = 'https://gitlab.com/eternaltwin/dinorpg/dinorpg/-/raw/4a30477dd01753d356e1af06e829f5893ca74b96/ed-ui/src/i18n/locales/fr.json';

// --- CONFIGURATION MANUELLE (NOUVEAU) ---

// 1. Force une race pour les compétences mal définies (ex: Invocations)
// Format : 'nom_nettoye': 'NomRace'
const MANUAL_RACE_FIX = {
    'bigmama': 'Moueffe',          // Invocation Moueffe
    'invocationtriceragnon': 'Moueffe',
    'totem': 'Castivore',          // Exemple (à vérifier)
    'spirit': 'Gorilloz',          // Exemple (à vérifier)
    'kamikaz': 'Kabuki'            // Exemple
};

// 2. Force des valeurs spécifiques (Écrase tout le reste)
const SKILL_OVERRIDES = {
    'envol': { raceId: null },    // <--- CORRECTION DEMANDÉE : Envol pour tous (Race = NULL)
    'flight': { raceId: null }
};


// --- TRADUCTIONS & MAPPINGS ---
const TYPE_MAP = {
    'SkillType.P': 'P', 'SkillType.A': 'A', 'SkillType.E': 'E', 'SkillType.U': 'U',
    'SkillType.S': 'S', 'SkillType.C': 'C', 'SkillType.M': 'M', 'SkillType.I': 'I',
    'SkillType.U': 'U'
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
    'RaceEnum.HIPPOCLAMP': 'Hippoclamp', 'RaceEnum.PTEROZ': 'Pteroz',
    'RaceEnum.MAHAMUTI': 'Mahamuti'
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

    // 1. Sépare minuscule suivie de majuscule (Ex: "CanonA" -> "Canon A")
    let pretty = name.replace(/([a-z])([A-Z])/g, '$1 $2');

    // 2. [AJOUT MAJEUR] Sépare une Majuscule collée à un nouveau mot (Ex: "AEau" -> "A Eau")
    // On cherche une Majuscule ($1) suivie d'une Majuscule+Minuscule ($2)
    pretty = pretty.replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');

    // 3. Gestion des apostrophes (D' )
    pretty = pretty.replace(/\sD\s/g, " d'");
    // pretty = pretty.replace(/D\sArtemis/g, "D'Artemis"); // Cas particulier

    // 4. [BONUS] Transforme le " A " isolé en " à " (Plus joli en français)
    pretty = pretty.replace(/\sA\s/g, " à ");

    // 5. Gestion des prépositions )
    pretty = pretty.replace(/\sLa\s/g, " la ");
    pretty = pretty.replace(/\sLe\s/g, " le ");
    pretty = pretty.replace(/\sDe\s/g, " de ");
    pretty = pretty.replace(/\sEn\s/g, " en ");
    pretty = pretty.replace(/\sDes\s/g, " des ");

    return pretty.trim();
}

async function syncSkills() {
    console.log("🚀 DÉMARRAGE SYNCHRO (Avec Correctifs Envol & Invocations)...");

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
        const enumRegex = /(\w+)\s*=\s*(\d+)/g;
        let match;
        while ((match = enumRegex.exec(mtsText)) !== null) {
            skillIdMap[`Skill.${match[1]}`] = parseInt(match[2]);
        }
        console.log(`✅ ${Object.keys(skillIdMap).length} IDs trouvés dans l'enum.`);

        // 4. PARSING DES BLOCS DE COMPÉTENCES
        const skillsToUpsert = [];
        const startRegex = /\[(Skill\.\w+)\]:\s*\{/g;
        const usedNames = new Set();

        while ((match = startRegex.exec(mtsText)) !== null) {
            const skillVarName = match[1];
            const id = skillIdMap[skillVarName];

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

            let prettyName = formatPrettyName(rawName);
            if (usedNames.has(prettyName)) {
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

            // D. Nature
            const sphereMatch = blockBody.match(/isSphereSkill:\s*(true|false)/);
            const isSphere = sphereMatch && sphereMatch[1] === 'true';

            const treeMatch = blockBody.match(/tree:\s*(SkillTreeType\.\w+)/);
            const treeType = treeMatch ? treeMatch[1] : 'SkillTreeType.VANILLA';

            let nature = 1;
            if (isSphere) {
                nature = 3;
            } else if (treeType === 'SkillTreeType.ETHER') {
                nature = 2;
            }

            // E. Race (LOGIQUE MIXTE : AUTO + MANUELLE)
            let raceEnum = null;
            let raceId = null;

            // 1. Détection automatique
            const raceMatchStandard = blockBody.match(/race:\s*(RaceEnum\.\w+)/);
            if (raceMatchStandard) raceEnum = raceMatchStandard[1];

            if (!raceEnum) {
                const availableMatch = blockBody.match(/availableFor:\s*\[\s*(RaceEnum\.\w+)/);
                if (availableMatch) raceEnum = availableMatch[1];
            }

            if (!raceEnum) {
                const anyRaceMatch = blockBody.match(/(RaceEnum\.\w+)/);
                if (anyRaceMatch) raceEnum = anyRaceMatch[1];
            }

            if (raceEnum) raceId = RACE_MAP[raceEnum] || null;

            // 2. Correction Manuelle (Ex: Big Mama -> Moueffe)
            // S'applique si aucune race n'a été trouvée OU pour forcer un changement
            if (MANUAL_RACE_FIX[searchKey]) {
                // Si la fix est définie, on l'applique (écrasement ou remplissage)
                // Ici on remplit seulement si c'est vide, ou tu peux décider d'écraser.
                // Pour l'instant, on écrase si c'est présent dans la liste FIX.
                raceId = MANUAL_RACE_FIX[searchKey];
            }

            // 3. Overrides Spécifiques (Ex: Envol -> NULL)
            if (SKILL_OVERRIDES[searchKey]) {
                const overrides = SKILL_OVERRIDES[searchKey];
                if (overrides.raceId !== undefined) {
                    raceId = overrides.raceId;
                }
            }

            // F. Parents (UnlockedFrom)
            const parentMatch = blockBody.match(/unlockedFrom:\s*\[([\s\S]*?)\]/);
            let parentIds = [];

            if (parentMatch && parentMatch[1].trim() !== '') {
                const parentsRaw = parentMatch[1].split(',').map(s => s.trim());

                parentsRaw.forEach(p => {
                    if (!p) return;
                    if (skillIdMap[p]) {
                        parentIds.push(skillIdMap[p]);
                    }
                    else if (!isNaN(p) && parseInt(p) > 0) {
                        parentIds.push(parseInt(p));
                    }
                });
            }

            // G. Modificateurs (Effects / GlobalEffects)
            let modifiers = {};
            const parseEffectsBlock = (blockName) => {
                const regex = new RegExp(blockName + ':\\s*\\{([\\s\\S]*?)\\}');
                const blockMatch = blockBody.match(regex);
                if (!blockMatch) return;

                const content = blockMatch[1];
                const statRegex = /\[Stat\.([A-Z_]+)\]:\s*(.+)/g;
                let statMatch;
                while ((statMatch = statRegex.exec(content)) !== null) {
                    const statName = statMatch[1];
                    let statValueStr = statMatch[2].replace(/,$/, '').trim();
                    let statValue;

                    if (statValueStr.startsWith("['x'")) {
                        const valMatch = statValueStr.match(/\[\s*'x'\s*,\s*([\d.]+)\s*\]/);
                        if (valMatch) statValue = { type: 'multiply', value: parseFloat(valMatch[1]) };
                    } else if (statValueStr.startsWith("['+'")) {
                        const valMatch = statValueStr.match(/\[\s*'\+'\s*,\s*([\d.-]+)\s*\]/);
                        if (valMatch) statValue = parseFloat(valMatch[1]);
                    } else {
                        const parsed = parseFloat(statValueStr);
                        if (!isNaN(parsed)) statValue = parsed;
                    }

                    if (statValue !== undefined) modifiers[statName] = statValue;
                }
            };

            parseEffectsBlock('effects');
            parseEffectsBlock('globalEffects');

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
                    raceId,
                    modifiers: Object.keys(modifiers).length > 0 ? modifiers : null
                },
                parentIds: parentIds
            });
        }

        console.log(`✅ Parsing terminé. ${skillsToUpsert.length} compétences prêtes à l'envoi.`);

        // 5. INSERTION EN BASE DE DONNÉES
        if (skillsToUpsert.length > 0) {
            console.log("💾 1/2 : Enregistrement des compétences...");
            let count = 0;
            for (const item of skillsToUpsert) {
                await prisma.refSkill.upsert({
                    where: { id: item.data.id },
                    update: item.data,
                    create: item.data
                });
                count++;
                if (count % 50 === 0) process.stdout.write('.');
            }
            console.log(`\n✅ ${count} compétences insérées/mises à jour.`);

            console.log("🔗 2/2 : Tissage des liens (Arbres)...");
            for (const item of skillsToUpsert) {
                // Gestion correcte des parents (écrasement)
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

syncSkills();