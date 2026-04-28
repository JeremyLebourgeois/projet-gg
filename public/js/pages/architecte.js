// Variables globales pour ce script
let selectedSkills = new Set();
let skillTiers = new Map();
let tooltip = document.getElementById('skill-tooltip');
let currentStats = {};
let currentElements = {};

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. SI ÉDITION : On restaure les données (PLAN_DATA vient du HTML)
    if (PLAN_DATA) {
        document.getElementById('plan-name').value = PLAN_DATA.name;
        document.getElementById('plan-race').value = PLAN_DATA.race;
        document.getElementById('plan-public').checked = PLAN_DATA.isPublic;

        if (PLAN_DATA.skillIds && Array.isArray(PLAN_DATA.skillIds)) {
            PLAN_DATA.skillIds.forEach(id => selectedSkills.add(id));
        }

        document.querySelector('.btn-save').innerHTML = '<i class="fas fa-save"></i> Mettre à jour';
    }

    // 2. Calculs initiaux
    calculateAllTiers();

    // 3. Rendu des arbres
    ['Feu', 'Bois', 'Eau', 'Foudre', 'Air'].forEach(elem => renderTreeForElement(elem));

    // 4. Mise à jour des stats
    updateStatsDisplay();

    const raceSelect = document.getElementById('plan-race');
    if (raceSelect) raceSelect.addEventListener('change', updateStatsDisplay);
});

// --- GESTION TOOLTIP ---
document.addEventListener('mousemove', (e) => {
    // On réupère le tooltip s'il n'est pas là (sécurité)
    if (!tooltip) tooltip = document.getElementById('skill-tooltip');

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

    let accessWarningHtml = '';
    const raceName = document.getElementById('plan-race').value.toLowerCase();
    if (raceName !== 'neutre') {
        const raceData = RACES_UP.find(r => {
            const normalized = r.race.toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/\s+/g, '_');
            return normalized === raceName || r.race.toLowerCase() === raceName;
        });

        if (raceData && raceData.elements) {
            const elemIds = ['Feu', 'Bois', 'Eau', 'Foudre', 'Air'];
            const elemIndex = elemIds.indexOf(skill.element);
            if (elemIndex !== -1 && raceData.elements[elemIndex] === "0%") {
                accessWarningHtml = `<div style="color: #ef5350; font-weight: bold; margin-top: 8px; padding-top: 5px; border-top: 1px dashed rgba(239,83,80,0.5); display: flex; align-items: center; gap: 5px;"><i class="fas fa-ban"></i> Élément inaccessible (0%)</div>`;
            }
        }
    }

    tooltip.innerHTML = `
        <span class="tooltip-title">${skill.name}</span>
        ${statsHtml}
        <div class="tooltip-desc">${skill.description || ''}</div>
        ${accessWarningHtml}
    `;
    tooltip.style.display = 'block';
}

function hideTooltip() {
    if (tooltip) tooltip.style.display = 'none';
}

// --- CALCULS ---
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

// --- RENDU ARBRES ---
function renderTreeForElement(elementName) {
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

    const roots = relevantSkills.filter(s => {
        const hasParentInList = s.parents.some(p => relevantSkills.find(rs => rs.id === p.id));
        return !hasParentInList;
    });
    roots.sort((a, b) => a.id - b.id);

    roots.forEach(root => {
        scaler.appendChild(buildInteractiveBranch(root, relevantSkills, elementName));
    });
    container.appendChild(scaler);
}

function buildInteractiveBranch(skill, contextSkills, elementName) {
    const branchContainer = document.createElement('div');
    branchContainer.className = 'skill-branch';

    const brick = document.createElement('div');
    brick.className = `skill-brick brick-${elementName.toLowerCase()}`;
    brick.id = `skill-${skill.id}`;
    brick.innerText = skill.name;

    if (selectedSkills.has(skill.id)) {
        brick.classList.add('selected');
    }

    brick.onclick = (e) => {
        e.stopPropagation();
        toggleSkillSelection(skill);
    };

    brick.addEventListener('mouseenter', () => showTooltip(skill));
    brick.addEventListener('mouseleave', () => hideTooltip());

    branchContainer.appendChild(brick);

    const children = contextSkills.filter(s => s.parents.some(p => p.id === skill.id));
    if (children.length > 0) {
        const col = document.createElement('div');
        col.className = 'children-column';
        children.sort((a, b) => a.id - b.id);
        children.forEach(child => {
            col.appendChild(buildInteractiveBranch(child, contextSkills, elementName));
        });
        branchContainer.appendChild(col);
    }

    return branchContainer;
}

// --- LOGIQUE DE SÉLECTION ---
function toggleSkillSelection(skill) {
    const brick = document.getElementById(`skill-${skill.id}`);
    if (selectedSkills.has(skill.id)) {
        deselectRecursively(skill);
    } else {
        const raceName = document.getElementById('plan-race').value.toLowerCase();
        
        if (raceName !== 'neutre') {
            const raceData = RACES_UP.find(r => {
                const normalized = r.race.toLowerCase()
                    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                    .replace(/\s+/g, '_');
                return normalized === raceName || r.race.toLowerCase() === raceName;
            });

            if (raceData && raceData.elements) {
                const elemIds = ['Feu', 'Bois', 'Eau', 'Foudre', 'Air'];
                const elemIndex = elemIds.indexOf(skill.element);
                if (elemIndex !== -1) {
                    const pct = raceData.elements[elemIndex];
                    if (pct === "0%") {
                        alert(`Le Dinoz de race ${raceData.race} n'a pas accès à l'élément ${skill.element} !`);
                        return;
                    }
                }
            }
        }

        selectedSkills.add(skill.id);
        brick.classList.add('selected');
        selectParentsRecursively(skill);
    }
    updateStatsDisplay();
}

function selectParentsRecursively(skill) {
    if (skill.parents && skill.parents.length > 0) {
        skill.parents.forEach(parentRef => {
            const parentSkill = ALL_SKILLS.find(s => s.id === parentRef.id);
            if (parentSkill && !selectedSkills.has(parentSkill.id)) {
                selectedSkills.add(parentSkill.id);
                const parentBrick = document.getElementById(`skill-${parentSkill.id}`);
                if (parentBrick) parentBrick.classList.add('selected');
                selectParentsRecursively(parentSkill);
            }
        });
    }
}

function deselectRecursively(skill) {
    selectedSkills.delete(skill.id);
    const brick = document.getElementById(`skill-${skill.id}`);
    if (brick) brick.classList.remove('selected');

    const children = ALL_SKILLS.filter(s => s.parents && s.parents.some(p => p.id === skill.id));
    children.forEach(child => {
        if (selectedSkills.has(child.id)) {
            deselectRecursively(child);
        }
    });
}

// --- CALCUL STATS ---
function updateStatsDisplay() {
    const raceName = document.getElementById('plan-race').value.toLowerCase();
    if (raceName !== 'neutre') {
        const raceData = RACES_UP.find(r => {
            const normalized = r.race.toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/\s+/g, '_');
            return normalized === raceName || r.race.toLowerCase() === raceName;
        });

        if (raceData && raceData.elements) {
            const elemIds = ['Feu', 'Bois', 'Eau', 'Foudre', 'Air'];
            
            selectedSkills.forEach(id => {
                const skill = ALL_SKILLS.find(s => s.id === id);
                if (skill) {
                    const elemIndex = elemIds.indexOf(skill.element);
                    if (elemIndex !== -1 && raceData.elements[elemIndex] === "0%") {
                        selectedSkills.delete(id);
                        const brick = document.getElementById(`skill-${id}`);
                        if (brick) brick.classList.remove('selected');
                    }
                }
            });
        }
    }

    const elements = ['Feu', 'Bois', 'Eau', 'Foudre', 'Air'];
    const idMap = { 'Feu': 'fire', 'Bois': 'wood', 'Eau': 'water', 'Foudre': 'lightning', 'Air': 'air' };
    let totalLevel = 1;

    let gridPoints = { fire: 0, wood: 0, water: 0, lightning: 0, air: 0 };

    elements.forEach(elem => {
        let skillCount = 0;
        let maxTier = 0;

        selectedSkills.forEach(id => {
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
        gridPoints[idMap[elem]] = elementTotal;
        totalLevel += elementTotal;

        const domId = `count-${idMap[elem]}`;
        const rowId = `row-${idMap[elem]}`;
        const elSpan = document.getElementById(domId);
        const elRow = document.getElementById(rowId);

        if (elSpan) elSpan.innerText = elementTotal;
        if (elementTotal > 0) elRow.classList.remove('zero');
        else elRow.classList.add('zero');
    });

    document.getElementById('level-display').innerText = totalLevel;
    window.calculatedLevel = totalLevel;

    calculateAllStats(gridPoints);
    updateRacePercentages();
}

function updateRacePercentages() {
    const raceName = document.getElementById('plan-race').value.toLowerCase();
    
    // On cherche la race dans RACES_UP (normalisation des noms pour la comparaison)
    const raceData = RACES_UP.find(r => {
        const normalized = r.race.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Enlever les accents
            .replace(/\s+/g, '_'); // Espaces -> underscore
        return normalized === raceName || r.race.toLowerCase() === raceName;
    });

    const elemIds = ['fire', 'wood', 'water', 'lightning', 'air'];
    
    if (raceData && raceData.elements) {
        elemIds.forEach((id, index) => {
            const pctSpan = document.getElementById(`pct-${id}`);
            if (pctSpan) {
                pctSpan.innerText = `(${raceData.elements[index]})`;
                pctSpan.style.display = 'inline';
            }
        });
        calculateSuccessProbability(raceData, elemIds);
    } else {
        // Si non trouvé, on met (0%) par défaut
        elemIds.forEach(id => {
            const pctSpan = document.getElementById(`pct-${id}`);
            if (pctSpan) {
                pctSpan.innerText = '(0%)';
                pctSpan.style.display = 'inline';
            }
        });
        document.getElementById('build-probability').innerText = '';
    }

    updateForbiddenSkills();
}

function updateForbiddenSkills() {
    const raceName = document.getElementById('plan-race').value.toLowerCase();
    
    if (raceName === 'neutre') {
        document.querySelectorAll('.skill-brick').forEach(brick => {
            brick.classList.remove('forbidden');
        });
        return;
    }
    
    const raceData = RACES_UP.find(r => {
        const normalized = r.race.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, '_');
        return normalized === raceName || r.race.toLowerCase() === raceName;
    });

    if (raceData && raceData.elements) {
        const elemIds = ['Feu', 'Bois', 'Eau', 'Foudre', 'Air'];
        
        document.querySelectorAll('.skill-brick').forEach(brick => {
            const skillId = parseInt(brick.id.replace('skill-', ''));
            const skill = ALL_SKILLS.find(s => s.id === skillId);
            
            if (skill) {
                const elemIndex = elemIds.indexOf(skill.element);
                if (elemIndex !== -1 && raceData.elements[elemIndex] === "0%") {
                    brick.classList.add('forbidden');
                } else {
                    brick.classList.remove('forbidden');
                }
            }
        });
    } else {
        document.querySelectorAll('.skill-brick').forEach(brick => {
            brick.classList.remove('forbidden');
        });
    }
}

function calculateSuccessProbability(raceData, elemIds) {
    const counts = {
        fire: parseInt(document.getElementById('count-fire').innerText) || 0,
        wood: parseInt(document.getElementById('count-wood').innerText) || 0,
        water: parseInt(document.getElementById('count-water').innerText) || 0,
        lightning: parseInt(document.getElementById('count-lightning').innerText) || 0,
        air: parseInt(document.getElementById('count-air').innerText) || 0
    };

    const n = Object.values(counts).reduce((a, b) => a + b, 0);
    if (n === 0) {
        document.getElementById('build-probability').innerText = '(100%)';
        return;
    }

    const probs = raceData.elements.map(p => parseFloat(p) / 100);
    
    // Formule Multinomiale : P = (N! / (k1! * k2! * ...)) * (p1^k1 * p2^k2 * ...)
    let logProb = logFactorial(n);
    let possible = true;

    elemIds.forEach((id, i) => {
        const k = counts[id];
        const p = probs[i];
        
        if (k > 0 && p === 0) possible = false;
        
        if (k > 0) {
            logProb -= logFactorial(k);
            logProb += k * Math.log(p);
        }
    });

    const probability = possible ? Math.exp(logProb) * 100 : 0;
    
    let displayProb = probability.toFixed(5) + "%";

    document.getElementById('build-probability').innerText = `(${displayProb} de réussite)`;
}

// Fonction utilitaire pour le factoriel (via log pour éviter les overflows et garder de la précision)
function logFactorial(n) {
    let res = 0;
    for (let i = 2; i <= n; i++) res += Math.log(i);
    return res;
}

function calculateAllStats(gridPoints) {
    const raceName = document.getElementById('plan-race').value.trim();
    const raceInfo = typeof RACES_DB !== 'undefined' ? RACES_DB.find(r => r.name.toLowerCase() === raceName.toLowerCase()) : null;

    const base = raceInfo ? {
        fire: raceInfo.baseFire, wood: raceInfo.baseWood, water: raceInfo.baseWater,
        bolt: raceInfo.baseBolt, air: raceInfo.baseAir
    } : { fire: 0, wood: 0, water: 0, bolt: 0, air: 0 };

    const ajout = {
        fire: parseInt(document.getElementById('ajout-fire')?.innerText) || 0,
        wood: parseInt(document.getElementById('ajout-wood')?.innerText) || 0,
        water: parseInt(document.getElementById('ajout-water')?.innerText) || 0,
        lightning: parseInt(document.getElementById('ajout-lightning')?.innerText) || 0,
        air: parseInt(document.getElementById('ajout-air')?.innerText) || 0,
    };

    let flatStats = {
        statLife: 100, statInitiative: 0, statArmor: 0,
        statFire: base.fire + ajout.fire + gridPoints.fire,
        statWood: base.wood + ajout.wood + gridPoints.wood,
        statWater: base.water + ajout.water + gridPoints.water,
        statBolt: base.bolt + ajout.lightning + gridPoints.lightning,
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

    selectedSkills.forEach(id => {
        const skill = ALL_SKILLS.find(s => s.id === id);
        if (skill && skill.modifiers) applyModifiers(skill.modifiers, flatStats, mults);
    });

    currentElements = {
        fire: flatStats.statFire,
        wood: flatStats.statWood,
        water: flatStats.statWater,
        bolt: flatStats.statBolt,
        air: flatStats.statAir
    };

    currentStats = {
        statLife: Math.round(flatStats.statLife * mults.statLife),
        statSpeed: parseFloat((flatStats.statSpeed * mults.statSpeed).toFixed(2)),
        statInitiative: Math.round(flatStats.statInitiative * mults.statInitiative),
        statArmor: parseFloat((flatStats.statArmor + (mults.statArmor - 1) * 100).toFixed(1)),
        statCounter: parseFloat((flatStats.statCounter + (mults.statCounter - 1) * 100).toFixed(1)),
        statEsquive: parseFloat((flatStats.statEsquive + (mults.statEsquive - 1) * 100).toFixed(1)),
        statSuperEsquive: parseFloat((flatStats.statSuperEsquive + (mults.statSuperEsquive - 1) * 100).toFixed(1)),
        statMultiHit: parseFloat((flatStats.statMultiHit + (mults.statMultiHit - 1) * 100).toFixed(1)),
        statTorche: Math.round(Math.pow(flatStats.statFire, 0.6)),
        statAcidBlood: Math.round(Math.pow(flatStats.statWater / 2, 0.6))
    };

    if (document.getElementById('stat-life')) {
        document.getElementById('stat-life').innerText = currentStats.statLife;
        document.getElementById('stat-speed').innerText = currentStats.statSpeed;
        document.getElementById('stat-initiative').innerText = currentStats.statInitiative;
        document.getElementById('stat-armor').innerText = currentStats.statArmor;
        document.getElementById('stat-counter').innerText = currentStats.statCounter + '%';
        if (document.getElementById('stat-esquive')) document.getElementById('stat-esquive').innerText = currentStats.statEsquive + '%';
        if (document.getElementById('stat-superesquive')) document.getElementById('stat-superesquive').innerText = currentStats.statSuperEsquive + '%';
        document.getElementById('stat-multihit').innerText = currentStats.statMultiHit + '%';

        if (document.getElementById('stat-torche')) document.getElementById('stat-torche').innerText = currentStats.statTorche;
        if (document.getElementById('stat-acidblood')) document.getElementById('stat-acidblood').innerText = currentStats.statAcidBlood;

        document.getElementById('stat-fire').innerText = currentElements.fire;
        document.getElementById('stat-wood').innerText = currentElements.wood;
        document.getElementById('stat-water').innerText = currentElements.water;
        document.getElementById('stat-lightning').innerText = currentElements.bolt;
        document.getElementById('stat-air').innerText = currentElements.air;
    }
}

function applyModifiers(modifiers, flatStats, mults) {
    if (typeof modifiers === 'string') {
        try { modifiers = JSON.parse(modifiers); } catch (e) { return; }
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

// --- SAUVEGARDE ---
async function savePlan() {
    const name = document.getElementById('plan-name').value;
    const race = document.getElementById('plan-race').value;
    const isPublic = document.getElementById('plan-public').checked;

    if (selectedSkills.size === 0) return alert("Sélectionnez au moins une compétence !");
    if (!name) return alert("Donnez un nom à votre plan !");

    if (race !== 'neutre') {
        const raceData = RACES_UP.find(r => {
            const normalized = r.race.toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/\s+/g, '_');
            return normalized === race.toLowerCase() || r.race.toLowerCase() === race.toLowerCase();
        });

        if (raceData && raceData.elements) {
            const elemIds = ['Feu', 'Bois', 'Eau', 'Foudre', 'Air'];
            let hasInvalidSkill = false;
            let invalidElem = '';

            selectedSkills.forEach(id => {
                const skill = ALL_SKILLS.find(s => s.id === id);
                if (skill) {
                    const elemIndex = elemIds.indexOf(skill.element);
                    if (elemIndex !== -1 && raceData.elements[elemIndex] === "0%") {
                        hasInvalidSkill = true;
                        invalidElem = skill.element;
                    }
                }
            });

            if (hasInvalidSkill) {
                return alert(`Le Dinoz de race ${raceData.race} n'a pas accès à l'élément ${invalidElem} ! Retirez ces compétences avant d'enregistrer.`);
            }
        }
    }

    const planId = PLAN_DATA ? PLAN_DATA.id : null;

    updateStatsDisplay();

    try {
        const ajout = {
            fire: parseInt(document.getElementById('ajout-fire')?.innerText) || 0,
            wood: parseInt(document.getElementById('ajout-wood')?.innerText) || 0,
            water: parseInt(document.getElementById('ajout-water')?.innerText) || 0,
            lightning: parseInt(document.getElementById('ajout-lightning')?.innerText) || 0,
            air: parseInt(document.getElementById('ajout-air')?.innerText) || 0,
        };

        const res = await fetch('/architecte/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: planId,
                name,
                race,
                isPublic,
                level: window.calculatedLevel || 1,
                selectedSkillIds: Array.from(selectedSkills),
                ajout,
                stats: currentStats,
                elements: currentElements
            })
        });
        const json = await res.json();
        if (json.success) {
            alert("Plan sauvegardé avec succès !");
            window.location.href = '/plans';
        } else {
            alert("Erreur : " + json.error);
        }
    } catch (e) {
        console.error(e);
        alert("Erreur serveur.");
    }
}

// --- GESTION DES BOUTONS + ET - ---
function updateAjout(element, change) {
    // 1. On cible l'élément HTML qui contient le chiffre
    const spanElement = document.getElementById(`ajout-${element}`);
    if (!spanElement) return; // Sécurité

    // 2. On lit la valeur actuelle affichée
    let currentValue = parseInt(spanElement.innerText) || 0;

    // 3. On calcule la nouvelle valeur
    let newValue = currentValue + change;

    // 4. On bloque à 0 minimum
    if (newValue < 0) return;

    // 5. On met à jour l'affichage
    spanElement.innerText = newValue;

    // 6. On met à jour les stats
    updateStatsDisplay();
}