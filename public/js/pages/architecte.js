// Variables globales pour ce script
let selectedSkills = new Set();
let skillTiers = new Map();
let tooltip = document.getElementById('skill-tooltip');

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
});

// --- GESTION TOOLTIP ---
document.addEventListener('mousemove', (e) => {
    // On réupère le tooltip s'il n'est pas là (sécurité)
    if(!tooltip) tooltip = document.getElementById('skill-tooltip');
    
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

function hideTooltip() { 
    if(tooltip) tooltip.style.display = 'none'; 
}

// --- CALCULS ---
function calculateAllTiers() {
    let changed = true;
    let pass = 0;
    while(changed && pass < 10) {
        changed = false;
        ALL_SKILLS.forEach(skill => {
            if (skillTiers.has(skill.id)) return;
            if (!skill.parents || skill.parents.length === 0) {
                skillTiers.set(skill.id, 1);
                changed = true;
            } else {
                let maxParentTier = 0;
                let allParentsKnown = true;
                for(let p of skill.parents) {
                    if (skillTiers.has(p.id)) {
                        maxParentTier = Math.max(maxParentTier, skillTiers.get(p.id));
                    } else {
                        const parentExists = ALL_SKILLS.find(s => s.id === p.id);
                        if(parentExists) allParentsKnown = false;
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
    roots.sort((a,b) => a.id - b.id);

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
        children.sort((a,b) => a.id - b.id);
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
                if(parentBrick) parentBrick.classList.add('selected');
                selectParentsRecursively(parentSkill); 
            }
        });
    }
}

function deselectRecursively(skill) {
    selectedSkills.delete(skill.id);
    const brick = document.getElementById(`skill-${skill.id}`);
    if(brick) brick.classList.remove('selected');

    const children = ALL_SKILLS.filter(s => s.parents && s.parents.some(p => p.id === skill.id));
    children.forEach(child => {
        if(selectedSkills.has(child.id)) {
            deselectRecursively(child);
        }
    });
}

// --- CALCUL STATS ---
function updateStatsDisplay() {
    const elements = ['Feu', 'Bois', 'Eau', 'Foudre', 'Air'];
    const idMap = { 'Feu':'fire', 'Bois':'wood', 'Eau':'water', 'Foudre':'lightning', 'Air':'air' };
    let totalLevel = 1;
    
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
}

// --- SAUVEGARDE ---
async function savePlan() {
    const name = document.getElementById('plan-name').value;
    const race = document.getElementById('plan-race').value;
    const isPublic = document.getElementById('plan-public').checked;
    
    if (selectedSkills.size === 0) return alert("Sélectionnez au moins une compétence !");
    if (!name) return alert("Donnez un nom à votre plan !");

    const planId = PLAN_DATA ? PLAN_DATA.id : null;
    
    updateStatsDisplay();

    try {
        const res = await fetch('/architecte/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: planId,
                name,
                race,
                isPublic,
                level: window.calculatedLevel || 1,
                selectedSkillIds: Array.from(selectedSkills)
            })
        });
        const json = await res.json();
        if (json.success) {
            alert("Plan sauvegardé avec succès !");
            window.location.href = '/plans';
        } else {
            alert("Erreur : " + json.error);
        }
    } catch(e) {
        console.error(e);
        alert("Erreur serveur.");
    }
}