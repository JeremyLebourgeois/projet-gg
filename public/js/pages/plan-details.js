// Récupération des données depuis le Pont
const ALL_SKILLS = PLAN_CONTEXT.allSkills;
const PLAN_SKILLS = new Set(PLAN_CONTEXT.planSkillIds);
const RACES_DB = PLAN_CONTEXT.raceListDb;

let skillTiers = new Map();
let tooltip = document.getElementById('skill-tooltip');

document.addEventListener('DOMContentLoaded', () => {
    if (!tooltip) tooltip = document.getElementById('skill-tooltip');

    calculateAllTiers();
    ['Feu', 'Bois', 'Eau', 'Foudre', 'Air'].forEach(elem => renderReadOnlyTree(elem));
    updateStatsDisplay();
});

// --- 1. CALCUL DES NIVEAUX (TIERS) ---
function calculateAllTiers() {
    let changed = true;
    let pass = 0;
    while (changed && pass < 10) {
        changed = false;
        ALL_SKILLS.forEach(skill => {
            if (skillTiers.has(skill.id)) return;
            if (!skill.parents || skill.parents.length === 0) {
                skillTiers.set(skill.id, 1);
                changed = true;
            } else {
                let maxParentTier = 0;
                let allParentsKnown = true;
                for (let p of skill.parents) {
                    if (skillTiers.has(p.id)) {
                        maxParentTier = Math.max(maxParentTier, skillTiers.get(p.id));
                    } else {
                        const parentExists = ALL_SKILLS.find(s => s.id === p.id);
                        if (parentExists) allParentsKnown = false;
                    }
                }
                if (allParentsKnown) {
                    skillTiers.set(skill.id, maxParentTier + 1);
                    changed = true;
                }
            }
        });
        pass++;
    }
}

// --- 2. CALCUL DES STATS ---
function updateStatsDisplay() {
    const elements = ['Feu', 'Bois', 'Eau', 'Foudre', 'Air'];
    const idMap = { 'Feu': 'fire', 'Bois': 'wood', 'Eau': 'water', 'Foudre': 'lightning', 'Air': 'air' };
    let totalLevel = 1;
    let gridPoints = { fire: 0, wood: 0, water: 0, lightning: 0, air: 0 };

    elements.forEach(elem => {
        let skillCount = 0;
        let maxTier = 0;

        PLAN_SKILLS.forEach(id => {
            const skill = ALL_SKILLS.find(s => s.id === id);
            if (skill && skill.element === elem) {
                skillCount++;
                const tier = skillTiers.get(id) || 1;
                if (tier > maxTier) maxTier = tier;
            }
        });

        let unlocks = 0;
        if (maxTier > 0) unlocks = maxTier - 1;

        const elementTotal = skillCount + unlocks;
        totalLevel += elementTotal;
        gridPoints[idMap[elem]] = elementTotal;

        const domId = `count-${idMap[elem]}`;
        const rowId = `row-${idMap[elem]}`;
        const elSpan = document.getElementById(domId);
        const elRow = document.getElementById(rowId);

        if (elSpan) elSpan.innerText = elementTotal;
        if (elRow) {
            if (elementTotal > 0) elRow.classList.remove('zero');
            else elRow.classList.add('zero');
        }
    });
    document.getElementById('level-display').innerText = totalLevel;

    calculateAllStats(gridPoints);
}

function calculateAllStats(gridPoints) {
    const raceName = PLAN_CONTEXT.planRace.trim();
    const raceInfo = typeof RACES_DB !== 'undefined' ? RACES_DB.find(r => r.name.toLowerCase() === raceName.toLowerCase()) : null;

    const base = raceInfo ? {
        fire: raceInfo.baseFire, wood: raceInfo.baseWood, water: raceInfo.baseWater,
        bolt: raceInfo.baseBolt, air: raceInfo.baseAir
    } : { fire: 0, wood: 0, water: 0, bolt: 0, air: 0 };

    const ajout = PLAN_CONTEXT.planAjout || { fire: 0, wood: 0, water: 0, lightning: 0, air: 0 };

    let flatStats = {
        statLife: 100, statInitiative: 0, statArmor: 0,
        statFire: base.fire + ajout.fire + gridPoints.fire,
        statWood: base.wood + ajout.wood + gridPoints.wood,
        statWater: base.water + ajout.water + gridPoints.water,
        statBolt: base.bolt + (ajout.lightning || ajout.bolt || 0) + gridPoints.lightning,
        statAir: base.air + ajout.air + gridPoints.air,
        statCounter: 0, statEsquive: 0, statSuperEsquive: 0, statMultiHit: 0, statSpeed: 10
    };

    let mults = {
        statSpeed: 1.0, statLife: 1.0, statInitiative: 1.0,
        statArmor: 1.0, statCounter: 1.0, statEsquive: 1.0, statSuperEsquive: 1.0, statMultiHit: 1.0
    };

    if (raceInfo && raceInfo.innateSkillId) {
        const innate = ALL_SKILLS.find(s => s.id === raceInfo.innateSkillId);
        if (innate && innate.modifiers) applyModifiers(innate.modifiers, flatStats, mults);
    }

    PLAN_SKILLS.forEach(id => {
        const skill = ALL_SKILLS.find(s => s.id === id);
        if (skill && skill.modifiers) applyModifiers(skill.modifiers, flatStats, mults);
    });

    if (document.getElementById('stat-life')) {
        document.getElementById('stat-life').innerText = Math.round(flatStats.statLife * mults.statLife);
        document.getElementById('stat-speed').innerText = parseFloat((flatStats.statSpeed * mults.statSpeed).toFixed(2));
        document.getElementById('stat-initiative').innerText = Math.round(flatStats.statInitiative * mults.statInitiative);
        document.getElementById('stat-armor').innerText = parseFloat((flatStats.statArmor + (mults.statArmor - 1) * 100).toFixed(1));
        document.getElementById('stat-counter').innerText = parseFloat((flatStats.statCounter + (mults.statCounter - 1) * 100).toFixed(1)) + '%';
        if (document.getElementById('stat-esquive')) document.getElementById('stat-esquive').innerText = parseFloat((flatStats.statEsquive + (mults.statEsquive - 1) * 100).toFixed(1)) + '%';
        if (document.getElementById('stat-superesquive')) document.getElementById('stat-superesquive').innerText = parseFloat((flatStats.statSuperEsquive + (mults.statSuperEsquive - 1) * 100).toFixed(1)) + '%';
        document.getElementById('stat-multihit').innerText = parseFloat((flatStats.statMultiHit + (mults.statMultiHit - 1) * 100).toFixed(1)) + '%';

        if (document.getElementById('stat-torche')) document.getElementById('stat-torche').innerText = Math.round(Math.pow(flatStats.statFire, 0.6));
        if (document.getElementById('stat-acidblood')) document.getElementById('stat-acidblood').innerText = Math.round(Math.pow(flatStats.statWater / 2, 0.6));

        document.getElementById('stat-fire').innerText = flatStats.statFire;
        document.getElementById('stat-wood').innerText = flatStats.statWood;
        document.getElementById('stat-water').innerText = flatStats.statWater;
        document.getElementById('stat-lightning').innerText = flatStats.statBolt;
        document.getElementById('stat-air').innerText = flatStats.statAir;
    }
}

function applyModifiers(modifiers, flatStats, mults) {
    if (typeof modifiers === 'string') {
        try {
            modifiers = JSON.parse(modifiers);
        } catch (e) {
            return;
        }
    }

    for (const [key, val] of Object.entries(modifiers)) {
        const isMult = val && typeof val === 'object' && val.type === 'multiply';
        const amount = isMult ? val.value : val;

        if (key === 'MAX_HP') isMult ? mults.statLife *= amount : flatStats.statLife += amount;
        else if (key === 'INITIATIVE') isMult ? mults.statInitiative *= amount : flatStats.statInitiative += amount;
        else if (key === 'ARMOR') isMult ? mults.statArmor *= amount : flatStats.statArmor += amount;
        else if (key === 'SPEED') isMult ? mults.statSpeed *= amount : flatStats.statSpeed += amount;
        else if (key === 'COUNTER') isMult ? mults.statCounter *= amount : flatStats.statCounter += amount;
        else if (key === 'EVASION' || key === 'DODGE' || key === 'ESQUIVE') isMult ? mults.statEsquive *= amount : flatStats.statEsquive += amount;
        else if (key === 'SUPER_EVASION') isMult ? mults.statSuperEsquive *= amount : flatStats.statSuperEsquive += amount;
        else if (key === 'MULTIHIT' || key === 'MULTI_HIT') isMult ? mults.statMultiHit *= amount : flatStats.statMultiHit += amount;
        else if (key === 'FIRE_ELEMENT') flatStats.statFire += amount;
        else if (key === 'WOOD_ELEMENT') flatStats.statWood += amount;
        else if (key === 'WATER_ELEMENT') flatStats.statWater += amount;
        else if (key === 'LIGHTNING_ELEMENT') flatStats.statBolt += amount;
        else if (key === 'AIR_ELEMENT') flatStats.statAir += amount;
    }
}

// --- 3. MOTEUR RENDU (LECTURE SEULE) ---
function renderReadOnlyTree(elementName) {
    const container = document.getElementById(`tree-container-${elementName}`);
    container.innerHTML = '';
    const scaler = document.createElement('div');
    scaler.className = 'tree-scaler';

    const relevantSkills = ALL_SKILLS.filter(s => {
        const isExactElem = s.element === elementName;
        const isTree1 = s.skillNature === 1;
        const isNotDouble = s.element !== 'Double';
        const isNotInvocation = s.type !== 'I';
        return isExactElem && isTree1 && isNotDouble && isNotInvocation;
    });

    if (relevantSkills.length === 0) {
        container.innerHTML = '<div style="color:#aaa; font-style:italic;">Vide</div>';
        return;
    }

    const roots = relevantSkills.filter(s => !s.parents.some(p => relevantSkills.find(rs => rs.id === p.id)));
    roots.sort((a, b) => a.id - b.id);
    roots.forEach(root => scaler.appendChild(buildReadOnlyBranch(root, relevantSkills, elementName)));
    container.appendChild(scaler);
}

function buildReadOnlyBranch(skill, contextSkills, elementName) {
    const branchContainer = document.createElement('div');
    branchContainer.className = 'skill-branch';

    const brick = document.createElement('div');
    brick.className = `skill-brick brick-${elementName.toLowerCase()}`;
    brick.innerText = skill.name;

    if (PLAN_SKILLS.has(skill.id)) {
        brick.classList.add('selected');
    }

    brick.addEventListener('mouseenter', () => showTooltip(skill));
    brick.addEventListener('mouseleave', () => hideTooltip());

    branchContainer.appendChild(brick);

    const children = contextSkills.filter(s => s.parents.some(p => p.id === skill.id));
    if (children.length > 0) {
        const col = document.createElement('div');
        col.className = 'children-column';
        children.sort((a, b) => a.id - b.id);
        children.forEach(child => col.appendChild(buildReadOnlyBranch(child, contextSkills, elementName)));
        branchContainer.appendChild(col);
    }
    return branchContainer;
}

// --- 4. GESTION TOOLTIP ---
document.addEventListener('mousemove', (e) => {
    if (tooltip && tooltip.style.display === 'block') {
        const offsetX = 15;
        const offsetY = 15;
        let left = e.pageX + offsetX;
        let top = e.pageY + offsetY;
        if (left + 280 > window.innerWidth) left = e.pageX - 295;
        if (top + 150 > window.innerHeight) top = e.pageY - 160;
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
    }
});

function showTooltip(skill) {
    let statsHtml = '';
    if (['A', 'E', 'I'].includes(skill.type)) {
        const proba = skill.probability > 0 ? `${skill.probability}%` : '-';
        const prio = skill.priority > 0 ? skill.priority : '-';
        statsHtml = `
            <span class="tooltip-meta">Type: ${skill.type} | E: ${skill.energy || 0}</span>
            <span class="tooltip-meta">Prio: ${prio} | Proba: ${proba}</span>
        `;
    } else {
        statsHtml = `<span class="tooltip-meta">Type: ${skill.type}</span>`;
    }
    if (skill.raceId) {
        statsHtml += `<span class="tooltip-meta" style="color: #f1c40f; font-weight: bold; margin-top: 5px;">Spécial : ${skill.raceId}</span>`;
    }
    tooltip.innerHTML = `
        <span class="tooltip-title">${skill.name}</span>
        ${statsHtml}
        <div class="tooltip-desc">${skill.description || ''}</div>
    `;
    tooltip.style.display = 'block';
}

function hideTooltip() { if (tooltip) tooltip.style.display = 'none'; }

// --- 5. ACTIONS ---
async function deletePlan(id) {
    if (!confirm("Supprimer ce plan définitivement ?")) return;
    try {
        const res = await fetch('/plan/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId: id })
        });
        if (res.ok) window.location.href = '/plans';
        else alert("Erreur suppression");
    } catch (e) { console.error(e); }
}

async function clonePlan(id) {
    if (!confirm("Copier ce plan dans votre collection ?")) return;
    try {
        const res = await fetch('/plan/clone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId: id })
        });
        if (res.ok) {
            alert("Plan copié !");
            window.location.href = '/plans';
        }
        else alert("Erreur clonage");
    } catch (e) { console.error(e); }
}

function editPlan(id) {
    window.location.href = `/architecte?id=${id}`;
}