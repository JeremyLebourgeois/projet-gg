const fs = require('fs');
const path = require('path');

const MTS_FILE = 'SkillList.mts';
const DESC_FILE = 'skillDescription.json';
const OUTPUT_FILE = 'competences.json';

// --- CONFIGURATION ---

// 1. AJOUT DE 'I' POUR LES INVOCATIONS
const TYPE_MAP = {
    'SkillType.P': 'P', 'SkillType.A': 'A', 'SkillType.E': 'E',
    'SkillType.S': 'S', 'SkillType.C': 'C', 'SkillType.M': 'M',
    'SkillType.I': 'I' 
};

const ELEMENT_MAP = {
    'ElementType.FIRE': 'Feu', 'ElementType.WOOD': 'Bois',
    'ElementType.WATER': 'Eau', 'ElementType.LIGHTNING': 'Foudre',
    'ElementType.AIR': 'Air', 'ElementType.VOID': 'Vide',
    'ElementType.Nothing': 'Neutre'
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

const MANUAL_FIXES = {
    'PeauDAcier': { nature: 2 },
};

// --- FONCTIONS ---

function parseEnergy(energyCode) {
    if (!energyCode || energyCode === 'Energy.NONE') return 0;
    const num = energyCode.replace('Energy.E', '').replace('Energy.', '');
    return parseInt(num) || 0;
}

function formatPrettyName(name) {
    if (!name) return "";
    let pretty = name.replace(/([a-z])([A-Z])/g, '$1 $2');
    pretty = pretty.replace(/\sD\s/g, " D'");
    pretty = pretty.replace(/D\sArtemis/g, "D'Artemis");
    return pretty;
}

function normalizeNameForSearch(name) {
    if (!name) return "";
    return name.toLowerCase()
               .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
               .replace(/\s+/g, '').replace(/'/g, '').replace(/-/g, '');
}

console.log("🔄 Extraction V7 : Type I & Correctifs...");

try {
    const mtsPath = path.join(__dirname, MTS_FILE);
    const descPath = path.join(__dirname, DESC_FILE);

    if (!fs.existsSync(mtsPath)) throw new Error(`Manque: ${MTS_FILE}`);
    if (!fs.existsSync(descPath)) throw new Error(`Manque: ${DESC_FILE}`);

    const mtsContent = fs.readFileSync(mtsPath, 'utf8');
    
    let descRaw = fs.readFileSync(descPath, 'utf8').trim();
    if (!descRaw.startsWith('{')) descRaw = '{' + descRaw + '}';
    const descContent = JSON.parse(descRaw);
    
    const rawDescriptions = descContent.description || descContent;
    const descriptionsNormalized = {};
    for (const [key, value] of Object.entries(rawDescriptions)) {
        descriptionsNormalized[normalizeNameForSearch(key)] = value;
    }

    const skillIdMap = {};
    const enumRegex = /(\w+)\s*=\s*(\d+),/g;
    let match;
    while ((match = enumRegex.exec(mtsContent)) !== null) {
        skillIdMap[`Skill.${match[1]}`] = parseInt(match[2]);
    }

    const skillsList = [];
    const startRegex = /\[(Skill\.\w+)\]:\s*\{/g;
    
    while ((match = startRegex.exec(mtsContent)) !== null) {
        const skillVarName = match[1];
        const id = skillIdMap[skillVarName];
        if (!id) continue;

        const startIndex = match.index + match[0].length - 1;
        let braceCount = 1;
        let endIndex = -1;
        for (let i = startIndex + 1; i < mtsContent.length; i++) {
            if (mtsContent[i] === '{') braceCount++;
            else if (mtsContent[i] === '}') braceCount--;
            if (braceCount === 0) { endIndex = i; break; }
        }
        if (endIndex === -1) continue;

        const blockBody = mtsContent.substring(startIndex, endIndex + 1);

        const nameMatch = blockBody.match(/name:\s*'([^']+)'/);
        const rawName = nameMatch ? nameMatch[1] : 'Inconnu';
        const prettyName = formatPrettyName(rawName);

        const searchName = normalizeNameForSearch(rawName);
        let desc = descriptionsNormalized[searchName];
        if (!desc && searchName.endsWith('s')) desc = descriptionsNormalized[searchName.slice(0, -1)];
        if (!desc) continue;

        // Extraction Type corrigée pour inclure 'I'
        const typeMatch = blockBody.match(/type:\s*(SkillType\.\w+)/);
        let type = typeMatch ? TYPE_MAP[typeMatch[1]] : 'P';
        
        const elemMatch = blockBody.match(/element:\s*\[(.*?)\]/);
        let elementStr = elemMatch ? elemMatch[1] : '';
        let elements = [];
        for (const [code, label] of Object.entries(ELEMENT_MAP)) {
            if (elementStr.includes(code)) elements.push(label);
        }
        let finalElement = elements.length > 1 ? 'Double' : (elements[0] || 'Vide');
        if (elements.length === 0 && elementStr.includes('VOID')) finalElement = 'Vide';

        const parentMatch = blockBody.match(/unlockedFrom:\s*\[([\s\S]*?)\]/);
        let parentIds = [];
        if (parentMatch && parentMatch[1].trim() !== '') {
            const parentsRaw = parentMatch[1].split(',').map(s => s.trim());
            parentsRaw.forEach(p => {
                if (!p) return;
                if (skillIdMap[p]) parentIds.push(skillIdMap[p]);
                else if (!isNaN(parseInt(p))) parentIds.push(parseInt(p));
            });
        }

        const probMatch = blockBody.match(/probability:\s*(\d+)/);
        const prob = probMatch ? parseInt(probMatch[1]) : 0;
        const prioMatch = blockBody.match(/priority:\s*(\d+)/);
        const prio = prioMatch ? parseInt(prioMatch[1]) : 0;
        const energyMatch = blockBody.match(/energy:\s*(Energy\.\w+)/);
        const energyRaw = energyMatch ? energyMatch[1] : 'Energy.NONE';
        const energy = parseEnergy(energyRaw);

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
        // J'ai retiré le bloc qui forçait nature=2 pour les types I

        if (MANUAL_FIXES[rawName]) {
            const fix = MANUAL_FIXES[rawName];
            if (fix.nature) nature = fix.nature;
            if (fix.forceParent) parentIds = fix.forceParent;
        }

        const raceMatch = blockBody.match(/race:\s*(RaceEnum\.\w+)/);
        let raceId = null;
        if (raceMatch && raceMatch[1]) {
            raceId = RACE_MAP[raceMatch[1]] || null;
        }

        skillsList.push({
            id: id,
            name: prettyName,
            type: type || 'P', // Si Type I détecté, il sera 'I'
            element: finalElement,
            parents: parentIds,
            description: desc,
            probability: prob,
            priority: prio,
            energy: energy,
            skillNature: nature,
            raceId: raceId
        });
    }

    fs.writeFileSync(path.join(__dirname, OUTPUT_FILE), JSON.stringify(skillsList, null, 2), 'utf8');
    console.log(`✅ ${skillsList.length} compétences extraites.`);

} catch (err) {
    console.error("❌ Erreur :", err.message);
}