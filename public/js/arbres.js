let currentTreeVersion = 1; 

// Récupération de la préférence serveur (si définie)
let isExpanded = (typeof USER_TREE_MODE !== 'undefined' && USER_TREE_MODE === 'EXPANDED');

let isSpheresView = false;

// On déclare la variable mais on ne la remplit pas tout de suite
let tooltip = null; 

document.addEventListener('DOMContentLoaded', () => {
    // On récupère le tooltip ici, quand on est sûr que la page est chargée
    tooltip = document.getElementById('skill-tooltip');

    // 1. Appliquer visuellement l'état initial
    const area = document.getElementById('main-display');
    const btn = document.getElementById('btn-expand');
    
    if (isExpanded) {
        area.classList.add('expanded');
        area.classList.remove('compressed');
        btn.innerText = "Réduire";
    } else {
        area.classList.add('compressed');
        area.classList.remove('expanded');
        btn.innerText = "Étendre";
    }

    // 2. Charger les arbres
    ['Feu', 'Bois', 'Eau', 'Foudre', 'Air'].forEach(elem => renderTreeForElement(elem));
    renderSpheresTable();
});

// --- TOOLTIP QUI SUIT LA SOURIS ---
document.addEventListener('mousemove', (e) => {
    // Sécurité : si le tooltip n'est pas encore chargé, on arrête
    if (!tooltip) tooltip = document.getElementById('skill-tooltip');
    if (!tooltip) return;

    // On déplace le tooltip (même s'il est caché, pour qu'il soit au bon endroit quand il apparait)
    const offset = 15;
    let x = e.clientX + offset;
    let y = e.clientY + offset;

    // Gestion des bords d'écran
    if (x + tooltip.offsetWidth > window.innerWidth) x = e.clientX - tooltip.offsetWidth - offset;
    if (y + tooltip.offsetHeight > window.innerHeight) y = e.clientY - tooltip.offsetHeight - offset;

    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
});
/* --- RENDU ARBRES --- */
function renderTreeForElement(elementName) {
    const container = document.getElementById(`tree-container-${elementName}`);
    container.innerHTML = '';

    const scaler = document.createElement('div');
    scaler.className = 'tree-scaler';
    
    const relevantSkills = ALL_SKILLS.filter(s => {
        const isExactElem = s.element === elementName;
        const isVersion = s.skillNature === currentTreeVersion; 
        const isNotDouble = s.element !== 'Double'; 
        const isNotInvocation = s.type !== 'I';
        return isExactElem && isVersion && isNotDouble && isNotInvocation;
    });

    if (relevantSkills.length === 0) {
        container.innerHTML = '<div style="color:#666; font-size:0.8rem; padding:10px;">Vide</div>';
        return;
    }

    const roots = relevantSkills.filter(s => {
        const hasParentInList = s.parents.some(p => relevantSkills.find(rs => rs.id === p.id));
        return !hasParentInList;
    });
    roots.sort((a,b) => a.id - b.id);

    roots.forEach(root => {
        scaler.appendChild(buildSkillBranch(root, relevantSkills, elementName));
    });

    container.appendChild(scaler);
}

function buildSkillBranch(skill, contextSkills, elementName) {
    const branchContainer = document.createElement('div');
    branchContainer.className = 'skill-branch';

    const brick = document.createElement('div');
    brick.className = `skill-brick brick-${elementName.toLowerCase()}`;
    brick.innerText = skill.name;
    brick.onmouseenter = () => showTooltip(skill);
    brick.onmouseleave = () => hideTooltip();
    branchContainer.appendChild(brick);

    const children = contextSkills.filter(s => s.parents.some(p => p.id === skill.id));
    if (children.length > 0) {
        const col = document.createElement('div');
        col.className = 'children-column';
        children.sort((a,b) => a.id - b.id);
        children.forEach(child => col.appendChild(buildSkillBranch(child, contextSkills, elementName)));
        branchContainer.appendChild(col);
    }
    return branchContainer;
}

/* --- AUTO ZOOM --- */
function expandItem(element) {
    if (isExpanded) return; 
    setTimeout(() => {
        const contentBox = element.querySelector('.tree-content');
        const scaler = element.querySelector('.tree-scaler');
        if (!contentBox || !scaler) return;

        scaler.style.transform = 'scale(1)'; 
        const hAvailable = contentBox.clientHeight - 40; 
        const wAvailable = contentBox.clientWidth - 40;
        const hTree = scaler.scrollHeight;
        const wTree = scaler.scrollWidth;

        let scale = 1;
        if (hTree > hAvailable || wTree > wAvailable) {
            scale = Math.min(hAvailable / hTree, wAvailable / wTree);
            scale = Math.max(scale, 0.4); 
        }
        scaler.style.transform = `scale(${scale})`;
    }, 300);
}

/* --- TOOLTIP --- */
/* --- TOOLTIP --- */
function showTooltip(skill) {
    let statsHtml = '';
    
    // 1. Affichage des stats de combat (Type, Energie, Proba...)
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

    // 2. NOUVEAU : Affichage de la Race requise si elle existe
    if (skill.raceId) {
        // J'ajoute une couleur dorée (#f1c40f) pour bien le mettre en valeur
        statsHtml += `<span class="tooltip-meta" style="color: #f1c40f; font-weight: bold; margin-top: 5px;">Spécial : ${skill.raceId}</span>`;
    }

    tooltip.innerHTML = `
        <span class="tooltip-title">${skill.name}</span>
        ${statsHtml}
        <div class="tooltip-desc">${skill.description || ''}</div>
    `;
    tooltip.style.display = 'block';
}
function hideTooltip() { tooltip.style.display = 'none'; }

/* --- SPHÈRES (DEBUG & ROBUSTESSE) --- */
function renderSpheresTable() {
    const container = document.getElementById('spheres-grid-container');
    
    // 1. Nettoyage : On supprime UNIQUEMENT les cellules de contenu (.sphere-cell)
    // On garde les 4 headers (.grid-header) qui sont en dur dans le HTML
    const oldCells = container.querySelectorAll('.sphere-cell');
    oldCells.forEach(c => c.remove());

    // 2. Liste des 6 éléments
    const elements = ['Feu', 'Bois', 'Eau', 'Foudre', 'Air', 'Vide'];
    
    elements.forEach(elem => {
        const bgClass = `brick-${elem.toLowerCase()}`;
        
        // 3. Filtrage : On cherche les compétences de Nature 3 (Sphères) pour cet élément
        const spheres = ALL_SKILLS.filter(s => 
            s.skillNature === 3 && 
            s.element && 
            s.element.trim().toLowerCase() === elem.toLowerCase()
        );
        
        // 4. Tri : On suppose que l'ID le plus petit est le Niveau 1, etc.
        spheres.sort((a,b) => a.id - b.id);

        // --- Colonne 1 : Le Titre de l'élément ---
        const titleDiv = document.createElement('div');
        titleDiv.className = `sphere-cell elem-title ${bgClass}`;
        titleDiv.innerText = elem;
        container.appendChild(titleDiv);

        // --- Colonnes 2, 3, 4 : Les Compétences (Niv 1, 2, 3) ---
        // On boucle 3 fois pour garantir l'alignement de la grille (même si une sphère manque)
        for(let i=0; i<3; i++) {
            const skill = spheres[i];
            const cell = document.createElement('div');
            cell.className = `sphere-cell ${bgClass}`;
            
            if (skill) {
                cell.innerText = skill.name;
                cell.style.cursor = 'help';
                // Ajout des interactions (Tooltip)
                cell.onmouseenter = () => showTooltip(skill);
                cell.onmouseleave = () => hideTooltip();
            } else {
                // Case vide si pas de compétence
                cell.innerText = "-"; 
                cell.style.opacity = "0.5";
            }
            container.appendChild(cell);
        }
    });
}

/* --- NAVIGATION AVEC SAUVEGARDE --- */
function toggleExpandMode() {
    const area = document.getElementById('main-display');
    const btn = document.getElementById('btn-expand');
    isExpanded = !isExpanded;
    
    // Reset zoom
    document.querySelectorAll('.tree-scaler').forEach(s => s.style.transform = 'scale(1)');

    const newMode = isExpanded ? 'EXPANDED' : 'COMPRESSED';

    if (isExpanded) {
        area.classList.add('expanded');
        area.classList.remove('compressed');
        btn.innerText = "Réduire";
    } else {
        area.classList.add('compressed');
        area.classList.remove('expanded');
        btn.innerText = "Étendre";
    }

    // SAUVEGARDE AJAX
    fetch('/api/preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'treeMode', value: newMode })
    }).catch(err => console.error("Erreur sauvegarde pref:", err));
}

function toggleTreeVersion() {
    currentTreeVersion = (currentTreeVersion === 1) ? 2 : 1;
    const btn = document.getElementById('btn-tree-switch');
    btn.innerText = (currentTreeVersion === 1) ? "Voir Arbre 2" : "Voir Arbre 1";
    ['Feu', 'Bois', 'Eau', 'Foudre', 'Air'].forEach(elem => renderTreeForElement(elem));
}

function toggleSpheresView() {
    const treeView = document.getElementById('trees-view');
    const sphereView = document.getElementById('spheres-view');
    const btn = document.getElementById('btn-spheres-switch');
    const btnExpand = document.getElementById('btn-expand');
    const btnSwitch = document.getElementById('btn-tree-switch');

    isSpheresView = !isSpheresView;

    if (isSpheresView) {
        treeView.style.display = 'none';
        sphereView.style.display = 'block';
        btn.innerText = "Retour Arbres";
        btnExpand.style.display = 'none';
        btnSwitch.style.display = 'none';
    } else {
        treeView.style.display = isExpanded ? 'block' : 'flex'; 
        sphereView.style.display = 'none';
        btn.innerText = "Voir Sphères";
        btnExpand.style.display = 'inline-block';
        btnSwitch.style.display = 'inline-block';
    }
}