// On récupère les données depuis le "Pont" (défini dans le HTML)
const ALL_SKILLS = DINO_DATA.allSkills;
const SERVER_LEARNED_IDS = DINO_DATA.serverLearnedIds;
const DINO_RACE = DINO_DATA.race;
const DINO_ID = DINO_DATA.id;
let localGrid = DINO_DATA.grid;
const PLAN_IDS = new Set(DINO_DATA.planIds);

// CONSTANTES
const PDC_SKILL = ALL_SKILLS.find(s => s.name === "Plan de Carrière" || s.name === "Plan de Carriere");
const PDC_ID = PDC_SKILL ? PDC_SKILL.id : 41304; 

const ELEM_MAP = { 
    'fire': 'Feu', 'wood': 'Bois', 'water': 'Eau', 'lightning': 'Foudre', 'bolt': 'Foudre', 'air': 'Air',
    'void': 'Vide','unknown': 'Inconnu'
};
const CSS_MAP = { 
    'Feu': 'fire', 'Bois': 'wood', 'Eau': 'water', 'Foudre': 'lightning', 'Air': 'air', 
    'Neutre': 'neutre', 'Vide': 'void',
    'Inconnu': 'up'
};

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    restoreGridVisuals();
    updateFullLogic();
    
    // Affichage des mini-arbres du plan si existant
    if (PLAN_IDS.size > 0) {
        renderMiniTrees();
    }

    // Ouverture auto de l'onglet Plans via URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('tab') === 'plans') {
        const tabBtn = document.querySelector('button[onclick*="tab-plans"]');
        if(tabBtn) tabBtn.click();
    }
});

// --- VISUEL ---
function setCellVisual(cell, type) {
    const content = cell.querySelector('.cell-content');
    cell.dataset.value = type;
    cell.className = cell.className.replace(/bg-\w+/g, "").trim();
    
    if (type === 'unknown') {
        cell.classList.add('bg-up');
        content.innerHTML = '<span class="text-badge">???</span>';
    } else {
        cell.classList.add('bg-' + type);
        content.innerHTML = `<img src="/img/elements/${type}.webp" style="width:24px;">`;
    }
}

function setDecisionVisual(cell, data) {
    const content = cell.querySelector('.cell-content');
    cell.dataset.decision = JSON.stringify(data);
    cell.className = cell.className.replace(/bg-\w+/g, "").trim();

    if (data.action === 'unlock') {
        const cssElem = CSS_MAP[data.element] || 'neutre';
        cell.classList.add('bg-' + cssElem); 
        content.innerHTML = `<span class="text-badge" style="font-size:1.4em;">+</span>`;
    } else if (data.action === 'learn') {
        const skill = ALL_SKILLS.find(s => s.id === data.skillId);
        if(skill) {
            const cssElem = CSS_MAP[skill.element] || 'neutre';
            cell.classList.add('bg-' + cssElem);
            content.innerHTML = `<span style="font-size:0.75rem; font-weight:bold; line-height:1.1; padding:0 2px;">${skill.name}</span>`;
        }
    } else if (data.action === 'skip') {
        cell.classList.add('bg-up');
        content.innerHTML = `<span class="text-badge">${data.label}</span>`;
    }
}

function resetCell(cell) {
    const content = cell.querySelector('.cell-content');
    delete cell.dataset.decision;
    delete cell.dataset.value;
    cell.className = cell.className.replace(/bg-\w+/g, "").trim();
    content.innerHTML = '<span class="placeholder">-</span>';
}

// --- LOGIQUE PRINCIPALE ---
function updateFullLogic() {
    const rows = document.querySelectorAll('#progression-table tbody tr');
    let state = { 
        learnedIds: new Set(SERVER_LEARNED_IDS), 
        pendingUnlocks: {}, 
        availableSkills: {}, 
        hasPDC: false 
    };
    
    const level1Skills = ALL_SKILLS.filter(s => 
        (!s.parents || s.parents.length === 0) && s.skillNature !== 3
    );

    ['Feu', 'Bois', 'Eau', 'Foudre', 'Air'].forEach(elem => {
        state.availableSkills[elem] = level1Skills.filter(s => s.element === elem).map(s => s.id);
        state.pendingUnlocks[elem] = new Set();
    });

    // Check PDC Global
    let doesPDCExistGlobally = false;
    rows.forEach(row => {
        const cell3 = row.querySelector('.col-3');
        if(cell3.dataset.decision && cell3.dataset.decision.includes(String(PDC_ID))) {
            doesPDCExistGlobally = true;
        }
    });

    rows.forEach((row, index) => {
        const cell1 = row.querySelector('.col-1');
        const cell2 = row.querySelector('.col-2');
        const cell3 = row.querySelector('.col-3');
        const rowIndex = row.dataset.rowIndex;

        // 1. Visibilité Colonne 2
        if (doesPDCExistGlobally) {
            document.querySelector('.col-choice-2').classList.remove('hidden');
            if (state.hasPDC) {
                cell2.classList.remove('hidden');
                cell2.style.visibility = 'visible';
            } else {
                cell2.classList.remove('hidden');
                cell2.style.visibility = 'hidden'; 
                cell2.dataset.value = ""; 
            }
        } else {
            document.querySelector('.col-choice-2').classList.add('hidden');
            cell2.classList.add('hidden');
        }

        // 2. Vérif Décision
        if (cell3.dataset.decision) {
            let isValid = false;
            try {
                const dec = JSON.parse(cell3.dataset.decision);
                if (dec.action === 'skip') {
                    isValid = true;
                } else {
                    const val1DB = ELEM_MAP[cell1.dataset.value];
                    const val2DB = state.hasPDC ? ELEM_MAP[cell2.dataset.value] : null; 
                    const decElem = dec.element;
                    if (decElem && (decElem === val1DB || (state.hasPDC && decElem === val2DB))) {
                        if (dec.action === 'unlock') {
                            isValid = true;
                        } else if (dec.action === 'learn') {
                            if (state.availableSkills[decElem] && state.availableSkills[decElem].includes(dec.skillId)) {
                                const s = ALL_SKILLS.find(sk => sk.id === dec.skillId);
                                let isAllowed = true;
                                if (s) {
                                    if (s.type === 'I') isAllowed = false;
                                    if (s.name === 'Envol') {
                                        const flyingRaces = ['planaille', 'nuageoz', 'pteroz', 'soufflet', 'pteroz demon'];
                                        if (!flyingRaces.includes(DINO_RACE.toLowerCase())) isAllowed = false;
                                    }
                                    if (s.skillNature === 2) isAllowed = false;
                                    if (s.element === 'Double') isAllowed = false;
                                    if (s.raceId && s.raceId.toLowerCase() !== DINO_RACE.toLowerCase()) isAllowed = false;
                                }
                                if (isAllowed) isValid = true;
                            }
                        }
                    }
                }
            } catch(e) {}

            if (!isValid) {
                resetCell(cell3);
                if(localGrid[rowIndex]) delete localGrid[rowIndex].col3;
                saveGridData(rowIndex, 3, ""); 
            }
        }

        // 3. Auto-remplissage
        const val1 = cell1.dataset.value;
        const isRealElement = val1 && val1 !== 'unknown';
        if (isRealElement && !state.hasPDC && !cell3.dataset.decision) {
            setCellVisual(cell3, val1);
        } 

        // 4. Application Décision
        if (cell3.dataset.decision) {
            const dec = JSON.parse(cell3.dataset.decision);
            if (dec.action === 'learn') {
                state.learnedIds.add(dec.skillId);
                if (dec.skillId === PDC_ID) state.hasPDC = true;
                
                const dbElem = dec.element;
                if (state.availableSkills[dbElem]) state.availableSkills[dbElem] = state.availableSkills[dbElem].filter(id => id !== dec.skillId);
                const skillData = ALL_SKILLS.find(s => s.id === dec.skillId);
                if (skillData) {
                    const children = ALL_SKILLS.filter(s => s.parents && s.parents.some(p => p.id === skillData.id) && s.skillNature !== 3);
                    children.forEach(child => {
                        if (!state.pendingUnlocks[dbElem]) state.pendingUnlocks[dbElem] = new Set();
                        state.pendingUnlocks[dbElem].add(child.id);
                    });
                }
            } else if (dec.action === 'unlock') {
                const elem = dec.element;
                if (state.pendingUnlocks[elem]) {
                    state.pendingUnlocks[elem].forEach(childId => {
                        if (!state.availableSkills[elem]) state.availableSkills[elem] = [];
                        state.availableSkills[elem].push(childId);
                    });
                    state.pendingUnlocks[elem].clear();
                }
            }
        }
    });
    updateRightColumn(state.learnedIds);
}

// --- MODALE ---
function handleDecisionClick(cell) {
    const row = cell.closest('tr');
    const rowIndex = parseInt(row.dataset.rowIndex);
    const type1 = row.querySelector('.col-1').dataset.value;
    const type2 = row.querySelector('.col-2').dataset.value;
    
    let targetElements = new Set();
    if (type1 && ELEM_MAP[type1] && type1 !== 'unknown') targetElements.add(ELEM_MAP[type1]);
    
    const cell2 = row.querySelector('.col-2');
    const isCol2Active = !cell2.classList.contains('hidden') && cell2.style.visibility !== 'hidden';
    if (isCol2Active && type2 && ELEM_MAP[type2] && type2 !== 'unknown') {
        targetElements.add(ELEM_MAP[type2]);
    }

    const uniqueElementsList = Array.from(targetElements);
    const options = getAvailableOptionsAtRow(rowIndex, uniqueElementsList);
    options.push({ type: 'skip', label: '???', name: 'Inconnu' });
    openSkillModal(cell, options);
}

function getAvailableOptionsAtRow(targetRowIndex, elementsFilter) {
    let state = { learnedIds: new Set(), pendingUnlocks: {}, availableSkills: {} };
    const level1Skills = ALL_SKILLS.filter(s => (!s.parents || s.parents.length === 0) && s.skillNature !== 3);
    ['Feu', 'Bois', 'Eau', 'Foudre', 'Air'].forEach(elem => {
        state.availableSkills[elem] = level1Skills.filter(s => s.element === elem).map(s => s.id);
        state.pendingUnlocks[elem] = new Set();
    });

    for (let i = 0; i < targetRowIndex; i++) {
        if (!localGrid[i] || !localGrid[i].col3) continue;
        try {
            const dec = JSON.parse(localGrid[i].col3);
            if (dec.action === 'learn') {
                state.learnedIds.add(dec.skillId);
                const dbElem = dec.element;
                if (state.availableSkills[dbElem]) state.availableSkills[dbElem] = state.availableSkills[dbElem].filter(id => id !== dec.skillId);
                const skillData = ALL_SKILLS.find(s => s.id === dec.skillId);
                if (skillData) {
                    const children = ALL_SKILLS.filter(s => s.parents && s.parents.some(p => p.id === skillData.id) && s.skillNature !== 3);
                    children.forEach(child => {
                        if (!state.pendingUnlocks[dbElem]) state.pendingUnlocks[dbElem] = new Set();
                        state.pendingUnlocks[dbElem].add(child.id);
                    });
                }
            } else if (dec.action === 'unlock') {
                const elem = dec.element;
                if (state.pendingUnlocks[elem]) {
                    state.pendingUnlocks[elem].forEach(childId => {
                        if (!state.availableSkills[elem]) state.availableSkills[elem] = [];
                        state.availableSkills[elem].push(childId);
                    });
                    state.pendingUnlocks[elem].clear();
                }
            }
        } catch(e) {}
    }

    let options = [];
    elementsFilter.forEach(elem => {
        if (state.pendingUnlocks[elem] && state.pendingUnlocks[elem].size > 0) {
            options.push({ type: 'unlock', element: elem, count: state.pendingUnlocks[elem].size });
        }
        if (state.availableSkills[elem]) {
            state.availableSkills[elem].forEach(skillId => {
                const s = ALL_SKILLS.find(sk => sk.id === skillId);
                if (s) {
                    let isAllowed = true;
                    if (s.type === 'I') isAllowed = false;
                    if (s.name === 'Envol') {
                        const flyingRaces = ['planaille', 'nuagoz', 'pteroz', 'soufflet', 'pteroz demon'];
                        if (!flyingRaces.includes(DINO_RACE.toLowerCase())) isAllowed = false;
                    }
                    if (s.skillNature === 2) isAllowed = false;
                    if (s.element === 'Double') isAllowed = false;
                    if (s.raceId && s.raceId.toLowerCase() !== DINO_RACE.toLowerCase()) isAllowed = false;

                    if (isAllowed) options.push({ type: 'learn', skill: s, element: elem });
                }
            });
        }
    });
    return options;
}

// --- UI HELPERS ---
function openSkillModal(targetCell, options) {
    const modal = document.getElementById('skill-selector-modal');
    const list = document.getElementById('modal-skill-list');
    list.innerHTML = '';
    
    options.forEach(opt => {
        const item = document.createElement('div');
        
        if (opt.type === 'skip') {
            item.className = `skill-item list-neutre`;
            item.style.cursor = 'pointer';
            item.innerHTML = `
                <div style="font-weight:bold; font-size:1.2em; width:30px; text-align:center;">${opt.label}</div>
                <span>${opt.name}</span>
            `;
            item.onclick = () => confirmChoice(targetCell, { action: 'skip', label: opt.label });
        } else {
            const cssElem = CSS_MAP[opt.element] || 'neutre';
            item.className = `skill-item list-${cssElem}`;
            item.style.cursor = 'pointer';

            if (opt.type === 'unlock') {
                item.innerHTML = `
                    <div style="font-weight:bold; font-size:1.5em; width:30px; text-align:center;">+</div>
                    <div style="display:flex; flex-direction:column;">
                        <span style="font-weight:bold;">Débloquer ${opt.element}</span>
                        <span style="font-size:0.8em; opacity:0.8;">${opt.count} en attente</span>
                    </div>
                `;
                item.onclick = () => confirmChoice(targetCell, { action: 'unlock', element: opt.element });
            } else {
                item.innerHTML = `
                    <img src="/img/elements/${cssElem}.webp" class="skill-icon-small">
                    <span>${opt.skill.name}</span>
                    <span style="margin-left:auto; font-size:0.8em; opacity:0.6;">${opt.skill.type || ''}</span>
                `;
                item.onclick = () => confirmChoice(targetCell, { action: 'learn', skillId: opt.skill.id, element: opt.element });
            }
        }
        list.appendChild(item);
    });
    modal.classList.remove('hidden');
}

function confirmChoice(cell, data) {
    document.getElementById('skill-selector-modal').classList.add('hidden');
    setDecisionVisual(cell, data);
    const row = cell.closest('tr');
    if (!localGrid[row.dataset.rowIndex]) localGrid[row.dataset.rowIndex] = {};
    localGrid[row.dataset.rowIndex].col3 = JSON.stringify(data);
    saveGridData(row.dataset.rowIndex, 3, JSON.stringify(data));
    updateFullLogic();
}

function closeSkillModal() {
    document.getElementById('skill-selector-modal').classList.add('hidden');
}

function updateRightColumn(learnedIdsSet) {
    const container = document.querySelector('#tab-skills .skill-list-container');
    container.innerHTML = '';
    if (learnedIdsSet.size === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#aaa;">Aucune compétence.</div>';
        return;
    }

    const ORDER = ['Feu', 'Bois', 'Eau', 'Foudre', 'Air', 'Vide', 'Neutre'];
    let skillsList = [];
    learnedIdsSet.forEach(id => {
        const skill = ALL_SKILLS.find(s => s.id === id);
        if(skill) skillsList.push(skill);
    });
    skillsList.sort((a, b) => {
        const idxA = ORDER.indexOf(a.element);
        const idxB = ORDER.indexOf(b.element);
        if(idxA !== idxB) return idxA - idxB;
        return a.id - b.id;
    });
    skillsList.forEach(skill => {
        const cssElem = CSS_MAP[skill.element] || 'neutre';
        const div = document.createElement('div');
        div.className = `skill-item list-${cssElem}`;
        div.innerHTML = `
            <img src="/img/elements/${cssElem}.webp" class="skill-icon-small">
            <span>${skill.name}</span>
            <span style="margin-left:auto; font-size:0.7em;">${skill.type || ''}</span>
        `;
        container.appendChild(div);
    });
}

function restoreGridVisuals() {
    document.querySelectorAll('.cell-choice').forEach(cell => {
         cell.className = cell.className.replace(/bg-\w+/g, "").trim();
         cell.querySelector('.cell-content').innerHTML = '<span class="placeholder">-</span>';
         delete cell.dataset.value;
         delete cell.dataset.decision;
    });
    for (const [rowIndex, cols] of Object.entries(localGrid)) {
        const row = document.querySelector(`tr[data-row-index="${rowIndex}"]`);
        if (!row) continue;
        if (cols.col1) setCellVisual(row.querySelector('.col-1'), cols.col1);
        if (cols.col2) setCellVisual(row.querySelector('.col-2'), cols.col2);
        if (cols.col3) {
            try {
                const data = JSON.parse(cols.col3);
                setDecisionVisual(row.querySelector('.col-3'), data);
            } catch(e) {}
        }
    }
}

// --- COMMUNICATION SERVEUR ---
async function saveGridData(rowIndex, colIndex, value) {
    try {
        const res = await fetch('/dinoz/update-grid', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dinoId: DINO_ID, rowIndex, colIndex, value })
        });
        const json = await res.json();
        
        if (json.success) {
            try {
                if (value) {
                    const parsedValue = JSON.parse(value);
                    if (parsedValue.skillId === 41406) {
                        window.location.reload();
                        return;
                    }
                }
            } catch (err) { console.error(err); }

            if (json.stats) {
                document.getElementById('val-fire').innerText = json.stats.statFire;
                document.getElementById('val-wood').innerText = json.stats.statWood;
                document.getElementById('val-water').innerText = json.stats.statWater;
                document.getElementById('val-bolt').innerText = json.stats.statBolt;
                document.getElementById('val-air').innerText = json.stats.statAir;
            }
            
            const lvlTxt = document.getElementById('dino-level-display');
            if(lvlTxt && json.level) {
                 lvlTxt.innerText = lvlTxt.innerText.replace(/Niveau \d+/, `Niveau ${json.level}`);
            }
        }
    } catch (err) { console.error(err); }
}

// --- INTERACTIONS ---
window.toggleMenu = function(cell) {
    if (cell.classList.contains('col-3')) {
        handleDecisionClick(cell);
    } else {
        if (cell.style.visibility === 'hidden') return;
        document.querySelectorAll('.cell-menu').forEach(m => m.classList.remove('visible'));
        cell.querySelector('.cell-menu').classList.add('visible');
    }
};

window.selectElement = function(el, type) {
    const cell = el.closest('.cell-choice');
    const row = cell.closest('tr');
    const colIndex = cell.classList.contains('col-2') ? 2 : 1;
    setCellVisual(cell, type);
    cell.querySelector('.cell-menu').classList.remove('visible');
    if (!localGrid[row.dataset.rowIndex]) localGrid[row.dataset.rowIndex] = {};
    localGrid[row.dataset.rowIndex][`col${colIndex}`] = type;
    saveGridData(row.dataset.rowIndex, colIndex, type);
    updateFullLogic(); 
};

function openTab(evt, tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    if(evt) evt.currentTarget.classList.add('active');
}

window.toggleStats = function() {
    const content = document.getElementById('dino-stats-content');
    const icon = document.getElementById('stats-icon');
    if(content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        icon.className = 'fas fa-chevron-up';
    } else {
        content.classList.add('hidden');
        icon.className = 'fas fa-chevron-down';
    }
};

window.openDeleteModal = function() { document.getElementById('delete-modal').classList.remove('hidden'); }
window.closeDeleteModal = function() { document.getElementById('delete-modal').classList.add('hidden'); }

// --- REINCARNATION ---
let bonusStats = { fire: 0, wood: 0, water: 0, lightning: 0, air: 0 };
let pointsLeft = 5;
const btnReincar = document.getElementById('btn-open-reincarnate');
const modalReincar = document.getElementById('reincarnate-modal');

if (btnReincar) {
    btnReincar.addEventListener('click', () => {
        modalReincar.classList.remove('hidden');
        resetDistributor();
    });
}
document.getElementById('cancel-reincarnate')?.addEventListener('click', () => modalReincar.classList.add('hidden'));

window.updatePoints = function(element, change) {
    if (change === 1 && pointsLeft <= 0) return;
    if (change === -1 && bonusStats[element] <= 0) return;
    bonusStats[element] += change;
    pointsLeft -= change;
    document.getElementById(`count-${element}`).innerText = bonusStats[element];
    document.getElementById('points-left').innerText = pointsLeft;
    const btnConfirm = document.getElementById('confirm-reincarnate');
    if (pointsLeft === 0) {
        btnConfirm.disabled = false;
        btnConfirm.style.opacity = "1";
        btnConfirm.style.cursor = "pointer";
        btnConfirm.style.background = "linear-gradient(180deg, #29b6f6, #0277bd)";
    } else {
        btnConfirm.disabled = true;
        btnConfirm.style.opacity = "0.5";
        btnConfirm.style.cursor = "not-allowed";
        btnConfirm.style.background = "#555";
    }
};

function resetDistributor() {
    bonusStats = { fire: 0, wood: 0, water: 0, lightning: 0, air: 0 };
    pointsLeft = 5;
    ['fire', 'wood', 'water', 'lightning', 'air'].forEach(el => {
        document.getElementById(`count-${el}`).innerText = "0";
    });
    document.getElementById('points-left').innerText = "5";
    const btnConfirm = document.getElementById('confirm-reincarnate');
    if(btnConfirm) {
        btnConfirm.disabled = true;
        btnConfirm.style.background = "#555";
    }
}

document.getElementById('confirm-reincarnate')?.addEventListener('click', async () => {
    try {
        const response = await fetch('/dinoz/reincarnate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dinoId: DINO_ID, bonuses: bonusStats })
        });
        if (response.ok) window.location.reload();
        else alert("Erreur lors de la réincarnation !");
    } catch (err) { console.error(err); }
});

// --- SPHERES ---
const modalSpheres = document.getElementById('spheres-modal');
const btnSpheres = document.getElementById('btn-open-spheres');
if(btnSpheres) {
    btnSpheres.addEventListener('click', () => modalSpheres.classList.remove('hidden'));
}
window.closeSpheresModal = function() { modalSpheres.classList.add('hidden'); }

let reloadOnAlert = false;
function showCustomAlert(title, message, reload = false) {
    document.getElementById('custom-alert-title').innerText = title;
    document.getElementById('custom-alert-message').innerText = message;
    reloadOnAlert = reload;
    document.getElementById('custom-alert-modal').classList.remove('hidden');
}
window.closeCustomAlert = function() {
    document.getElementById('custom-alert-modal').classList.add('hidden');
    if (reloadOnAlert) window.location.reload();
}

let pendingSphereElement = null;
window.useSphere = function(element) {
    pendingSphereElement = element;
    const nomElement = ELEM_MAP[element] || element;
    const message = `Voulez-vous vraiment consommer une sphère <strong style="color:#4fc3f7">${nomElement}</strong> ?<br><span style="font-size:0.8em; color:#aaa;">Cette action est définitive.</span>`;    document.getElementById('confirm-message').innerHTML = message;
    document.getElementById('confirm-action-modal').classList.remove('hidden');
};
window.closeConfirmModal = function() {
    document.getElementById('confirm-action-modal').classList.add('hidden');
    pendingSphereElement = null;
};
document.getElementById('btn-confirm-yes').addEventListener('click', async () => {
    const element = pendingSphereElement; 
    if (!element) return;
    closeConfirmModal();
    try {
        const response = await fetch('/dinoz/add-sphere', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dinoId: DINO_ID, element })
        });
        const json = await response.json();
        if (response.ok) {
            if (typeof closeSpheresModal === 'function') closeSpheresModal();
            showCustomAlert("Sphère Consommée !", `Votre dinoz a appris la compétence ${json.skillName} !`, true);
        } else {
            showCustomAlert("Erreur", "Impossible d'utiliser la sphère : " + json.error, false);
        }
    } catch (err) {
        console.error(err);
        showCustomAlert("Erreur", "Problème technique avec le serveur.", false);
    }
});

// --- PLANS ---
window.openPlanModal = function() { document.getElementById('plan-selection-modal').classList.remove('hidden'); }
window.removePlan = async function() {
    if(!confirm("Retirer le plan actuel de ce Dinoz ?")) return;
    assignPlan(null);
}
window.assignPlan = async function(planId) {
    try {
        const response = await fetch('/dinoz/assign-plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dinoId: DINO_ID, planId: planId })
        });
        if (response.ok) {
            window.location.href = window.location.pathname + "?tab=plans";
        } else {
            alert("Erreur lors de l'assignation du plan.");
        }
    } catch (e) {
        console.error(e);
        alert("Erreur technique.");
    }
}

// --- MINI ARBRES ---
function renderMiniTrees() {
    const container = document.getElementById('mini-trees-container');
    if (!container) return;
    container.innerHTML = '';
    ['Feu', 'Bois', 'Eau', 'Foudre', 'Air'].forEach(elem => {
        const skillsInPlanForElem = ALL_SKILLS.filter(s => s.element === elem && PLAN_IDS.has(s.id));
        if (skillsInPlanForElem.length === 0) return;

        const block = document.createElement('div');
        block.className = 'mini-tree-block';
        block.innerHTML = `<div class="mini-elem-title" style="color:${getColorForElem(elem)}">${elem}</div>`;
        
        const wrapper = document.createElement('div');
        wrapper.className = 'mini-tree-wrapper';
        
        const roots = skillsInPlanForElem.filter(s => !s.parents.some(p => PLAN_IDS.has(p.id)));
        roots.sort((a,b) => a.id - b.id);

        roots.forEach(root => {
            wrapper.appendChild(buildMiniBranch(root, skillsInPlanForElem, elem));
        });
        block.appendChild(wrapper);
        container.appendChild(block);
    });
}

function buildMiniBranch(skill, pool, elementName) {
    const branchContainer = document.createElement('div');
    branchContainer.className = 'skill-branch';
    
    const brick = document.createElement('div');
    brick.className = `skill-brick brick-${elementName.toLowerCase()} selected`; 
    brick.innerText = skill.name;
    brick.addEventListener('mouseenter', () => showTooltip(skill));
    brick.addEventListener('mouseleave', () => hideTooltip());
    branchContainer.appendChild(brick);

    const children = pool.filter(s => s.parents.some(p => p.id === skill.id));
    if (children.length > 0) {
        const col = document.createElement('div');
        col.className = 'children-column';
        children.sort((a,b) => a.id - b.id);
        children.forEach(child => col.appendChild(buildMiniBranch(child, pool, elementName)));
        branchContainer.appendChild(col);
    }
    return branchContainer;
}

function getColorForElem(elem) {
    const map = { 'Feu':'#ef5350', 'Bois':'#66bb6a', 'Eau':'#42a5f5', 'Foudre':'#ffee58', 'Air':'#b0bec5' };
    return map[elem] || '#fff';
}

// --- TOOLTIP ---
const tooltip = document.getElementById('skill-tooltip');
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
    if (!tooltip) return;
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