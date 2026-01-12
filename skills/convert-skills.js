const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const MTS_FILE = 'SkillList.mts';
const DESC_FILE = 'skillDescription.json';
const OUTPUT_FILE = 'competences.json';

const TYPE_MAP = {
    'SkillType.P': 'P', 'SkillType.A': 'A', 'SkillType.E': 'E',
    'SkillType.S': 'S', 'SkillType.C': 'C', 'SkillType.M': 'M'
};

const ELEMENT_MAP = {
    'ElementType.FIRE': 'Feu', 'ElementType.WOOD': 'Bois',
    'ElementType.WATER': 'Eau', 'ElementType.LIGHTNING': 'Foudre',
    'ElementType.AIR': 'Air', 'ElementType.VOID': 'Vide',
    'ElementType.Nothing': 'Neutre'
};

function parseEnergy(energyCode) {
    if (!energyCode || energyCode === 'Energy.NONE') return 0;
    const num = energyCode.replace('Energy.E', '').replace('Energy.', '');
    return parseInt(num) || 0;
}

function normalizeName(name) {
    if (!name) return "";
    return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
               .replace(/\s+/g, '').replace(/'/g, '').replace(/-/g, '');
}

console.log("🔄 Extraction avec FILTRE (Uniquement avec description)...");

try {
    const mtsPath = path.join(__dirname, MTS_FILE);
    const descPath = path.join(__dirname, DESC_FILE);

    if (!fs.existsSync(mtsPath)) throw new Error(`Manque: ${MTS_FILE}`);
    if (!fs.existsSync(descPath)) throw new Error(`Manque: ${DESC_FILE}`);

    const mtsContent = fs.readFileSync(mtsPath, 'utf8');
    
    let descRaw = fs.readFileSync(descPath, 'utf8').trim();
    if (!descRaw.startsWith('{')) descRaw = '{' + descRaw + '}';
    const descContent = JSON.parse(descRaw);
    const descriptions = descContent.description || descContent;

    const skillIdMap = {};
    const enumRegex = /(\w+)\s*=\s*(\d+),/g;
    let match;
    while ((match = enumRegex.exec(mtsContent)) !== null) {
        skillIdMap[`Skill.${match[1]}`] = parseInt(match[2]);
    }

    const skillsList = [];
    const startRegex = /\[(Skill\.\w+)\]:\s*\{/g;
    let ignoredCount = 0;
    
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
        const name = nameMatch ? nameMatch[1] : 'Inconnu';

        // --- RECHERCHE DESCRIPTION ---
        const cleanName = normalizeName(name);
        let desc = descriptions[name] || descriptions[cleanName];
        if (!desc && descriptions[cleanName.replace(/s$/, '')]) desc = descriptions[cleanName.replace(/s$/, '')];

        // --- LE FILTRE EST ICI ---
        if (!desc) {
            ignoredCount++;
            // On passe à la suivante sans l'ajouter
            continue;
        }

        // Si on a une description, on continue l'extraction des autres infos
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

        const parentMatch = blockBody.match(/unlockedFrom:\s*\[(.*?)\]/);
        let parentIds = [];
        if (parentMatch && parentMatch[1].trim() !== '') {
            const parentsRaw = parentMatch[1].split(',');
            parentsRaw.forEach(p => {
                const pClean = p.trim();
                if (skillIdMap[pClean]) parentIds.push(skillIdMap[pClean]);
            });
        }

        const probMatch = blockBody.match(/probability:\s*(\d+)/);
        const prob = probMatch ? parseInt(probMatch[1]) : 0;

        const prioMatch = blockBody.match(/priority:\s*(\d+)/);
        const prio = prioMatch ? parseInt(prioMatch[1]) : 0;

        const energyMatch = blockBody.match(/energy:\s*(Energy\.\w+)/);
        const energyRaw = energyMatch ? energyMatch[1] : 'Energy.NONE';
        const energy = parseEnergy(energyRaw);
        
        skillsList.push({
            id: id,
            name: name,
            type: type || 'P',
            element: finalElement,
            parents: parentIds,
            description: desc,
            probability: prob,
            priority: prio,
            energy: energy
        });
    }

    fs.writeFileSync(path.join(__dirname, OUTPUT_FILE), JSON.stringify(skillsList, null, 2), 'utf8');
    console.log(`✅ SUCCÈS ! ${skillsList.length} compétences valides extraites.`);
    console.log(`🗑️  ${ignoredCount} compétences ignorées (car sans description).`);

} catch (err) {
    console.error("❌ Erreur :", err.message);
}