let DINOZ_DATA, PLAN_DATA, SKILLS_DATA, RACES_DATA;

const state = {
    fighters: [],
    teamA: [],
    teamB: [],
    activeA: 0,
    activeB: 0,
    shieldA: false,
    shieldB: false,
    displayRange: false,
    filterType: 'all',
    selectedRaces: [],
    selectedPlayers: []
};

// Constantes de combat
const BASE_ATTACK_VALUE = 2;
const BASE_DEFENSE_VALUE = 0;
const ASSAULT_POWER = 5;
const ATTACK_GLOBAL_FACTOR = 1.0;

const SKILLS_POWER = {
    "Coup de Pression": 10,
    "Alizé": 8,
    "Vague de Froid": 12,
    "Boulier": 0,
    "Sieste": 0
};

document.addEventListener('DOMContentLoaded', () => {
    init();
});

function init() {
    try {
        DINOZ_DATA = JSON.parse(document.getElementById('dinoz-data').textContent);
        PLAN_DATA = JSON.parse(document.getElementById('plan-data').textContent);
        SKILLS_DATA = JSON.parse(document.getElementById('skills-data').textContent);
        RACES_DATA = JSON.parse(document.getElementById('races-data').textContent);

        console.log("Données chargées:", { dinozs: DINOZ_DATA.length, plans: PLAN_DATA.length });

        // On transforme tout en "combattants" uniformes
        state.fighters = [
            ...DINOZ_DATA.map(d => buildFighterData(d, false)),
            ...PLAN_DATA.map(p => buildFighterData(p, true))
        ];

        populateFilters();
        
        // Par défaut, on ne sélectionne que le joueur actuel
        const currentPseudoEl = document.getElementById('current-user-pseudo');
        const currentPseudo = currentPseudoEl ? currentPseudoEl.textContent.trim() : "";
        if (currentPseudo) {
            state.selectedPlayers = [currentPseudo];
            updateDropdownSelection('player', [currentPseudo]);
        }

        attachEventListeners();
        updateRange();
        buildFightersList();
    } catch (e) {
        console.error("Erreur lors de l'initialisation:", e);
    }
}

function buildFighterData(data, isGhost) {
    const uniqueId = (isGhost ? 'ghost_' : 'real_') + data.id;
    const raceInfo = RACES_DATA.find(r => r.name === data.race);
    const skillIds = isGhost ? (data.skillIds || []) : (data.learnedSkills || []).map(s => s.id);

    let flatStats = {
        statFire: 0, statWood: 0, statWater: 0, statBolt: 0, statAir: 0,
        statLife: 100, statInitiative: 0, statArmor: 0, statSpeed: 10, statCounter: 0, statEsquive: 0, statSuperEsquive: 0, statMultiHit: 0,
        statAssaultFire: 0, statAssaultWood: 0, statAssaultWater: 0, statAssaultBolt: 0, statAssaultAir: 0,
        defFire: 0, defWood: 0, defWater: 0, defBolt: 0, defAir: 0,
        defRatioFire: 0, defRatioWood: 0, defRatioWater: 0, defRatioBolt: 0, defRatioAir: 0,
        resilience: 40
    };

    let mults = { statArmor: 1.0, statLife: 1.0, statInitiative: 1.0, statSpeed: 1.0, statCounter: 1.0, statEsquive: 1.0, statSuperEsquive: 1.0, statMultiHit: 1.0 };

    let shouldApplyElementModifiers = isGhost;
    if (isGhost) {
        if (data.elements) {
            shouldApplyElementModifiers = false;
            flatStats.statFire = data.elements.fire || 0;
            flatStats.statWood = data.elements.wood || 0;
            flatStats.statWater = data.elements.water || 0;
            flatStats.statBolt = data.elements.bolt || data.elements.lightning || 0;
            flatStats.statAir = data.elements.air || 0;
        } else {
            // Pour les plans, on calcule les éléments de base depuis les compétences (1 up = 1 point)
            skillIds.forEach(id => {
                const skill = SKILLS_DATA.find(s => s.id === id);
                if (skill) {
                    if (skill.element === 'Feu') flatStats.statFire++;
                    else if (skill.element === 'Bois') flatStats.statWood++;
                    else if (skill.element === 'Eau') flatStats.statWater++;
                    else if (skill.element === 'Foudre') flatStats.statBolt++;
                    else if (skill.element === 'Air') flatStats.statAir++;
                }
            });
            // On ajoute les bases de la race pour les plans (car non stocké en BDD pour les plans)
            if (raceInfo) {
                flatStats.statFire += raceInfo.baseFire || 0;
                flatStats.statWood += raceInfo.baseWood || 0;
                flatStats.statWater += raceInfo.baseWater || 0;
                flatStats.statBolt += raceInfo.baseBolt || 0;
                flatStats.statAir += raceInfo.baseAir || 0;
            }
        }

        if (data.stats) {
            flatStats.statLife = data.stats.statLife || 100;
            flatStats.statSpeed = data.stats.statSpeed || 10;
            flatStats.statInitiative = data.stats.statInitiative || 0;
            flatStats.statArmor = data.stats.statArmor || 0;
            flatStats.statCounter = data.stats.statCounter || 0;
            flatStats.statEsquive = data.stats.statEsquive || 0;
            flatStats.statSuperEsquive = data.stats.statSuperEsquive || 0;
            flatStats.statMultiHit = data.stats.statMultiHit || 0;
        }
    } else {
        // Pour les Dinozs réels, on utilise les stats déjà calculées et sauvegardées en BDD
        flatStats.statFire = data.statFire || 0;
        flatStats.statWood = data.statWood || 0;
        flatStats.statWater = data.statWater || 0;
        flatStats.statBolt = data.statBolt || 0;
        flatStats.statAir = data.statAir || 0;
        flatStats.statLife = data.statLife || 100;
        flatStats.statSpeed = data.statSpeed || 10;
        flatStats.statInitiative = data.statInitiative || 0;
        flatStats.statArmor = data.statArmor || 0;
        flatStats.statCounter = data.statCounter || 0;
        flatStats.statEsquive = data.statEsquive || 0;
        flatStats.statSuperEsquive = data.statSuperEsquive || 0;
        flatStats.statMultiHit = data.statMultiHit || 0;
    }

    // Appliquer les modificateurs de compétences
    if (raceInfo && raceInfo.innateSkillId) {
        const innate = SKILLS_DATA.find(s => s.id === raceInfo.innateSkillId);
        if (innate && innate.modifiers) applyModifiersFighter(innate.modifiers, flatStats, mults, shouldApplyElementModifiers);
    }

    let attacks = [];
    let allSkills = [];
    skillIds.forEach(id => {
        const skill = SKILLS_DATA.find(s => s.id === id);
        if (skill) {
            allSkills.push(skill);
            if (skill.modifiers) applyModifiersFighter(skill.modifiers, flatStats, mults, shouldApplyElementModifiers);
            if (skill.type && skill.type.includes('A')) {
                if (skill.name.toLowerCase() === 'sieste') return;
                if (skill.energy > 0 || (skill.note && (skill.note.toLowerCase().includes('dégât') || skill.note.toLowerCase().includes('score')))) {
                    attacks.push(skill);
                }
            }
        }
    });

    const finalArmor = parseFloat((flatStats.statArmor + (mults.statArmor - 1) * 100).toFixed(1));
    const finalLife = Math.round(flatStats.statLife * mults.statLife);
    const finalInitiative = Math.round(flatStats.statInitiative * mults.statInitiative);
    const finalSpeed = parseFloat((flatStats.statSpeed * mults.statSpeed).toFixed(2));
    const finalCounter = parseFloat((flatStats.statCounter + (mults.statCounter - 1) * 100).toFixed(1));
    const finalEsquive = parseFloat((flatStats.statEsquive + (mults.statEsquive - 1) * 100).toFixed(1));
    const finalSuperEsquive = parseFloat((flatStats.statSuperEsquive + (mults.statSuperEsquive - 1) * 100).toFixed(1));
    const finalMultiHit = parseFloat((flatStats.statMultiHit + (mults.statMultiHit - 1) * 100).toFixed(1));

    return {
        uid: uniqueId,
        id: data.id,
        name: isGhost ? data.name + " (P)" : data.name,
        race: data.race,
        level: data.level,
        player: isGhost ? (data.author ? data.author.pseudo : 'Clan') : (data.user ? data.user.pseudo : 'Inconnu'),
        isGhost: isGhost,
        role: data.role || '',
        imageUrl: isGhost ? `/img/races/${data.race.toLowerCase()}.png` : (data.imageUrl || `/img/races/${data.race.toLowerCase()}.png`),
        stats: {
            armor: finalArmor, life: finalLife, initiative: finalInitiative, speed: finalSpeed,
            counter: finalCounter, esquive: finalEsquive, superEsquive: finalSuperEsquive, multiHit: finalMultiHit,
            resilience: flatStats.resilience
        },
        elements: {
            fire: flatStats.statFire, wood: flatStats.statWood, water: flatStats.statWater, bolt: flatStats.statBolt, air: flatStats.statAir
        },
        assaultBonus: {
            fire: flatStats.statAssaultFire, wood: flatStats.statAssaultWood, water: flatStats.statAssaultWater, bolt: flatStats.statAssaultBolt, air: flatStats.statAssaultAir
        },
        defenses: calculateDefenses(flatStats,
            { fire: flatStats.defRatioFire, wood: flatStats.defRatioWood, water: flatStats.defRatioWater, bolt: flatStats.defRatioBolt, air: flatStats.defRatioAir },
            { fire: flatStats.defFire, wood: flatStats.defWood, water: flatStats.defWater, bolt: flatStats.defBolt, air: flatStats.defAir }),
        attacks: attacks,
        allSkills: allSkills
    };
}

function applyModifiersFighter(modifiers, flatStats, mults, isGhost = true) {
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

        else if (isGhost && key === 'FIRE_ELEMENT') flatStats.statFire += amount;
        else if (isGhost && key === 'WOOD_ELEMENT') flatStats.statWood += amount;
        else if (isGhost && key === 'WATER_ELEMENT') flatStats.statWater += amount;
        else if (isGhost && key === 'LIGHTNING_ELEMENT') flatStats.statBolt += amount;
        else if (isGhost && key === 'AIR_ELEMENT') flatStats.statAir += amount;

        else if (key === 'FIRE_ASSAULT') flatStats.statAssaultFire += amount;
        else if (key === 'WOOD_ASSAULT') flatStats.statAssaultWood += amount;
        else if (key === 'WATER_ASSAULT') flatStats.statAssaultWater += amount;
        else if (key === 'LIGHTNING_ASSAULT') flatStats.statAssaultBolt += amount;
        else if (key === 'AIR_ASSAULT') flatStats.statAssaultAir += amount;

        else if (key === 'FIRE_DEFENSE') flatStats.defFire += amount;
        else if (key === 'WOOD_DEFENSE') flatStats.defWood += amount;
        else if (key === 'WATER_DEFENSE') flatStats.defWater += amount;
        else if (key === 'LIGHTNING_DEFENSE') flatStats.defBolt += amount;
        else if (key === 'AIR_DEFENSE') flatStats.defAir += amount;

        else if (key === 'FIRE_DEFENSE_RATIO') flatStats.defRatioFire += amount;
        else if (key === 'WOOD_DEFENSE_RATIO') flatStats.defRatioWood += amount;
        else if (key === 'WATER_DEFENSE_RATIO') flatStats.defRatioWater += amount;
        else if (key === 'LIGHTNING_DEFENSE_RATIO') flatStats.defRatioBolt += amount;
        else if (key === 'AIR_DEFENSE_RATIO') flatStats.defRatioAir += amount;
    }
}

function calculateDefenses(finalStats, ratios, mods) {
    const f = finalStats.statFire + (ratios.fire || 0);
    const w = finalStats.statWood + (ratios.wood || 0);
    const wa = finalStats.statWater + (ratios.water || 0);
    const b = finalStats.statBolt + (ratios.bolt || 0);
    const a = finalStats.statAir + (ratios.air || 0);

    return {
        fire: parseFloat((f * 1 + w * 0.5 + wa * 0.5 + b * 1.5 + a * 1.5 + (mods.fire || 0)).toFixed(1)),
        wood: parseFloat((f * 1.5 + w * 1 + wa * 0.5 + b * 0.5 + a * 1.5 + (mods.wood || 0)).toFixed(1)),
        water: parseFloat((f * 1.5 + w * 1.5 + wa * 1 + b * 0.5 + a * 0.5 + (mods.water || 0)).toFixed(1)),
        lightning: parseFloat((f * 0.5 + w * 1.5 + wa * 1.5 + b * 1 + a * 0.5 + (mods.bolt || 0)).toFixed(1)),
        air: parseFloat((f * 0.5 + w * 0.5 + wa * 1.5 + b * 1.5 + a * 1 + (mods.air || 0)).toFixed(1))
    };
}

function populateFilters() {
    let playersSet = new Set();
    state.fighters.forEach(f => {
        if (f.player) playersSet.add(f.player);
    });

    const players = Array.from(playersSet).sort();

    // Population Joueurs
    const playerDropdown = document.getElementById('player-dropdown-list');
    if (playerDropdown) {
        playerDropdown.innerHTML = '';
        const allItem = document.createElement('div');
        allItem.className = 'dropdown-item all-option';
        allItem.innerHTML = `<strong>Tous les joueurs</strong>`;
        allItem.onclick = (e) => {
            e.stopPropagation();
            state.selectedPlayers = [];
            playerDropdown.querySelectorAll('.dropdown-item').forEach(el => el.classList.remove('active'));
            playerDropdown.querySelectorAll('.dropdown-item input').forEach(chk => chk.checked = false);
            updateDropdownLabel('player');
            buildFightersList();
        };
        playerDropdown.appendChild(allItem);

        players.forEach(p => {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            item.innerHTML = `<input type="checkbox" value="${p}" id="chk-p-${p}"><label for="chk-p-${p}">${p}</label>`;
            item.onclick = (e) => {
                e.stopPropagation();
                const chk = item.querySelector('input');
                if (e.target !== chk) chk.checked = !chk.checked;
                const idx = state.selectedPlayers.indexOf(p);
                if (chk.checked) { if (idx === -1) state.selectedPlayers.push(p); item.classList.add('active'); }
                else { if (idx > -1) state.selectedPlayers.splice(idx, 1); item.classList.remove('active'); }
                updateDropdownLabel('player');
                buildFightersList();
            };
            playerDropdown.appendChild(item);
        });
    }

    // Initialisation du multi-sélecteur de races (Dropdown)
    const raceDropdown = document.getElementById('race-dropdown-list');
    const races = [
        "Castivore", "Gorilloz", "Hippoclamp", "Moueffe", "Nuagoz", "Pigmou", "Planaille",
        "Pteroz", "Rocky", "Sirain", "Wanwan", "Winks", "Feross", "Kabuki", "Mahamuti",
        "Quetzu", "Santaz", "Smog", "Soufflet", "Toufufu", "Triceragnon"
    ];

    if (raceDropdown) {
        raceDropdown.innerHTML = '';
        
        // Option "Toutes"
        const allItem = document.createElement('div');
        allItem.className = 'dropdown-item all-option';
        allItem.innerHTML = `<strong>Toutes les races</strong>`;
        allItem.onclick = (e) => {
            e.stopPropagation();
            state.selectedRaces = [];
            raceDropdown.querySelectorAll('.dropdown-item').forEach(el => el.classList.remove('active'));
            raceDropdown.querySelectorAll('.dropdown-item input').forEach(chk => chk.checked = false);
            updateDropdownLabel('race');
            buildFightersList();
        };
        raceDropdown.appendChild(allItem);

        races.forEach(race => {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            item.innerHTML = `
                <input type="checkbox" value="${race}" id="chk-${race}">
                <label for="chk-${race}">${race}</label>
            `;
            
            item.onclick = (e) => {
                e.stopPropagation();
                const chk = item.querySelector('input');
                if (e.target !== chk) chk.checked = !chk.checked;
                
                const index = state.selectedRaces.indexOf(race);
                if (chk.checked) {
                    if (index === -1) state.selectedRaces.push(race);
                    item.classList.add('active');
                } else {
                    if (index > -1) state.selectedRaces.splice(index, 1);
                    item.classList.remove('active');
                }
                updateDropdownLabel();
                buildFightersList();
            };
            raceDropdown.appendChild(item);
        });
    }
}

function updateDropdownSelection(type, values) {
    const list = document.getElementById(`${type}-dropdown-list`);
    if (!list) return;
    list.querySelectorAll('.dropdown-item').forEach(item => {
        const chk = item.querySelector('input');
        if (chk && values.includes(chk.value)) {
            chk.checked = true;
            item.classList.add('active');
        }
    });
    updateDropdownLabel(type);
}

function updateDropdownLabel(type) {
    const label = document.getElementById(`${type}-dropdown-selected`);
    const selected = type === 'race' ? state.selectedRaces : state.selectedPlayers;
    const defaultText = type === 'race' ? "Toutes" : "Tous";
    const pluralText = type === 'race' ? "races" : "joueurs";

    if (!label) return;
    if (selected.length === 0) {
        label.textContent = defaultText;
    } else if (selected.length === 1) {
        label.textContent = selected[0];
    } else {
        label.textContent = `${selected.length} ${pluralText}`;
    }
}

function attachEventListeners() {
    ['filter-player'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', buildFightersList);
    });

    // Toggle Dropdowns
    const dropdowns = [
        { header: 'race-dropdown-selected', list: 'race-dropdown-list' },
        { header: 'player-dropdown-selected', list: 'player-dropdown-list' }
    ];

    dropdowns.forEach(d => {
        const h = document.getElementById(d.header);
        const l = document.getElementById(d.list);
        if (h && l) {
            h.onclick = (e) => {
                e.stopPropagation();
                // Fermer les autres dropdowns
                dropdowns.forEach(od => { if(od.list !== d.list) document.getElementById(od.list).classList.add('hidden'); });
                l.classList.toggle('hidden');
            };
        }
    });

    document.addEventListener('click', (e) => {
        dropdowns.forEach(d => {
            const l = document.getElementById(d.list);
            if (l && !l.contains(e.target)) l.classList.add('hidden');
        });
    });

    ['filter-level-min', 'filter-level-max'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            updateRange();
            buildFightersList();
        });
    });

    // Filtre Type par boutons
    document.querySelectorAll('#filter-type-group .toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#filter-type-group .toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.filterType = btn.dataset.value;
            buildFightersList();
        });
    });

    document.getElementById('btn-clear-a').addEventListener('click', () => { state.teamA = []; updateTeamsDOM(); buildFightersList(); });
    document.getElementById('btn-clear-b').addEventListener('click', () => { state.teamB = []; updateTeamsDOM(); buildFightersList(); });

    document.getElementById('btn-start-mode1').addEventListener('click', () => {
        document.getElementById('selection-section').classList.add('hidden');
        document.getElementById('analysis-section').classList.remove('hidden');
        startMode1();
    });

    document.getElementById('btn-back-selection').addEventListener('click', () => {
        document.getElementById('analysis-section').classList.add('hidden');
        document.getElementById('selection-section').classList.remove('hidden');
    });

    document.getElementById('toggle-display-range').addEventListener('change', (e) => {
        state.displayRange = e.target.checked;
        renderMode1Panels();
    });

    document.getElementById('select-a').addEventListener('change', (e) => { state.activeA = parseInt(e.target.value); renderMode1Panels(); });
    document.getElementById('select-b').addEventListener('change', (e) => { state.activeB = parseInt(e.target.value); renderMode1Panels(); });
}

window.updateRange = function () {
    const rangeMin = document.getElementById('filter-level-min');
    const rangeMax = document.getElementById('filter-level-max');
    const sliderRange = document.getElementById('slider-range');
    const tipMin = document.getElementById('tip-min');
    const tipMax = document.getElementById('tip-max');

    let v1 = parseInt(rangeMin.value);
    let v2 = parseInt(rangeMax.value);

    let minVal = Math.min(v1, v2);
    let maxVal = Math.max(v1, v2);

    // Calcul des pourcentages pour positionnement
    const pV1 = ((v1 - 1) / 79) * 100;
    const pV2 = ((v2 - 1) / 79) * 100;
    const pMin = ((minVal - 1) / 79) * 100;
    const pMax = ((maxVal - 1) / 79) * 100;

    sliderRange.style.left = pMin + "%";
    sliderRange.style.width = (pMax - pMin) + "%";

    // Positionnement des tooltips sur les poignées réelles (pas forcément min/max)
    tipMin.textContent = v1;
    tipMin.style.left = pV1 + "%";

    tipMax.textContent = v2;
    tipMax.style.left = pV2 + "%";
};

function buildFightersList() {
    const type = state.filterType;
    const selectedRaces = state.selectedRaces;
    const selectedPlayers = state.selectedPlayers;
    const rMin = parseInt(document.getElementById('filter-level-min').value);
    const rMax = parseInt(document.getElementById('filter-level-max').value);
    const minLvl = Math.min(rMin, rMax);
    const maxLvl = Math.max(rMin, rMax);


    const listContainer = document.getElementById('fighter-list-container');
    listContainer.innerHTML = '';

    const filtered = state.fighters.filter(f => {
        if (type !== 'all' && (type === 'real' ? f.isGhost : !f.isGhost)) return false;
        
        if (selectedRaces.length > 0) {
            const fRace = (f.race || "").trim().toLowerCase();
            const isMatch = selectedRaces.some(r => r.trim().toLowerCase() === fRace);
            if (!isMatch) return false;
        }
        if (f.level < minLvl || f.level > maxLvl) return false;
        if (selectedPlayers.length > 0) {
            const fPlayer = (f.player || "").trim().toLowerCase();
            const isMatch = selectedPlayers.some(p => p.trim().toLowerCase() === fPlayer);
            if (!isMatch) return false;
        }
        return true;
    });

    const skillsTooltip = document.getElementById('sim-skill-tooltip') || (() => {
        const el = document.createElement('div');
        el.id = 'sim-skill-tooltip';
        el.style.cssText = 'position:fixed;background:#161b22;border:1px solid #58a6ff;border-radius:8px;padding:10px 14px;font-size:0.82em;color:#c9d1d9;pointer-events:none;display:none;z-index:9999;max-width:280px;line-height:1.6;box-shadow:0 4px 20px rgba(0,0,0,0.5);';
        document.body.appendChild(el);
        return el;
    })();

    document.addEventListener('mousemove', (e) => {
        if (skillsTooltip.style.display === 'block') {
            let x = e.clientX + 15, y = e.clientY + 10;
            if (x + 290 > window.innerWidth) x = e.clientX - 295;
            if (y + skillsTooltip.offsetHeight > window.innerHeight) y = e.clientY - skillsTooltip.offsetHeight - 10;
            skillsTooltip.style.left = x + 'px';
            skillsTooltip.style.top = y + 'px';
        }
    });

    filtered.forEach(f => {
        const inA = state.teamA.some(x => x.uid === f.uid);
        const inB = state.teamB.some(x => x.uid === f.uid);
        const div = document.createElement('div');
        div.className = 'fighter-card';
        div.innerHTML = `
            <div class="fighter-info">
                <img src="${f.imageUrl}" style="width: 90px; height: 90px; border-radius: 10px; margin: 6px auto; display: block; object-fit: contain;">
                <div class="fighter-name">${f.name}</div>
                <div class="fighter-details">Lvl ${f.level} - ${f.race}</div>
            </div>
            <div class="fighter-actions">
                <button class="btn-add-team btn-a ${inA ? 'in-team' : ''}" onclick="toggleTeam('${f.uid}', 'A', this)">${inA ? '− A' : '+ A'}</button>
                <button class="btn-add-team btn-b ${inB ? 'in-team' : ''}" onclick="toggleTeam('${f.uid}', 'B', this)">${inB ? '− B' : '+ B'}</button>
            </div>
        `;

        div.addEventListener('mouseenter', () => {
            if (!f.allSkills.length) return;
            skillsTooltip.innerHTML = '<div style="color:#58a6ff;font-weight:bold;margin-bottom:4px;">Compétences</div>' +
                '<div style="display:flex;flex-wrap:wrap;gap:4px;">' +
                f.allSkills.map(s => `<span style="background:#21262d;border:1px solid #30363d;border-radius:4px;padding:2px 7px;font-size:0.85em;white-space:nowrap;">${s.name}</span>`).join('') +
                '</div>';
            skillsTooltip.style.display = 'block';
        });
        div.addEventListener('mouseleave', () => { skillsTooltip.style.display = 'none'; });

        listContainer.appendChild(div);
    });
}

window.toggleTeam = function (uid, teamCode, btn) {
    const team = teamCode === 'A' ? state.teamA : state.teamB;
    const existing = team.findIndex(x => x.uid === uid);
    if (existing >= 0) {
        team.splice(existing, 1);
        btn.textContent = `+ ${teamCode}`;
        btn.classList.remove('in-team');
    } else {
        if (team.length >= 6) return;
        const f = state.fighters.find(x => x.uid === uid);
        if (!f) return;
        team.push({ ...f, id_team: Date.now() });
        btn.textContent = `− ${teamCode}`;
        btn.classList.add('in-team');
    }
    updateTeamsDOM();
};

window.removeFromTeam = function (index, teamCode) {
    if (teamCode === 'A') state.teamA.splice(index, 1);
    else state.teamB.splice(index, 1);
    updateTeamsDOM();
    buildFightersList(); // On rafraîchit la liste pour mettre à jour les boutons +/-
};

function updateTeamsDOM() {
    document.getElementById('team-a-count').innerText = state.teamA.length;
    document.getElementById('team-b-count').innerText = state.teamB.length;
    const renderSlots = (team, teamCode) => team.map((f, i) => `
        <div class="slot-card">
            <img src="${f.imageUrl}" style="width: 28px; height: 28px; border-radius: 4px; margin-right: 10px;">
            <span style="flex:1">${f.name} (Lvl ${f.level})</span>
            <button class="btn-remove-slot" onclick="removeFromTeam(${i}, '${teamCode}')"><i class="fas fa-times"></i></button>
        </div>
    `).join('');
    document.getElementById('team-a-slots').innerHTML = renderSlots(state.teamA, 'A');
    document.getElementById('team-b-slots').innerHTML = renderSlots(state.teamB, 'B');
    document.getElementById('btn-start-mode1').disabled = !(state.teamA.length > 0 && state.teamB.length > 0);
}

function startMode1() {
    state.activeA = 0; state.activeB = 0;
    const populateSelect = (id, team) => {
        document.getElementById(id).innerHTML = team.map((f, i) => `<option value="${i}">${f.name} (Lvl ${f.level})</option>`).join('');
    };
    populateSelect('select-a', state.teamA);
    populateSelect('select-b', state.teamB);
    renderMode1Panels();
}

function renderMode1Panels() {
    const fA = state.teamA[state.activeA];
    const fB = state.teamB[state.activeB];
    if (!fA || !fB) return;

    // Aura Hermétique : n'afficher le bouton que si le Dinoz possède la compétence
    const hasAuraA = (fA.allSkills || []).some(s => s.name === 'Aura Hermétique' || s.name === 'Aura Hermetique');
    const hasAuraB = (fB.allSkills || []).some(s => s.name === 'Aura Hermétique' || s.name === 'Aura Hermetique');
    const btnA = document.getElementById('btn-shield-a');
    const btnB = document.getElementById('btn-shield-b');

    if (!hasAuraA) state.shieldA = false;
    if (!hasAuraB) state.shieldB = false;

    if (btnA) { btnA.style.display = hasAuraA ? 'inline-flex' : 'none'; btnA.classList.toggle('active', state.shieldA); }
    if (btnB) { btnB.style.display = hasAuraB ? 'inline-flex' : 'none'; btnB.classList.toggle('active', state.shieldB); }

    // Panel A : Dégâts de A vers l'équipe B
    document.getElementById('stats-container-a').innerHTML = buildStatsHtml(fA, state.teamB);
    renderFighterSheetInContainer('sheet-a', fA);

    // Panel B : Dégâts de B vers l'équipe A
    document.getElementById('stats-container-b').innerHTML = buildStatsHtml(fB, state.teamA);
    renderFighterSheetInContainer('sheet-b', fB);
}

function renderFighterSheetInContainer(containerId, fighter) {
    const elemImg = (key) => `<img src="/img/elements/${key === 'bolt' ? 'lightning' : key}.webp" style="width:18px;height:18px;vertical-align:middle;margin-right:5px;">`;
    const html = `
        <div class="sheet-title">Informations Techniques</div>
        <div class="sheet-grid">
            <div class="sheet-col">
                <h4>Éléments</h4>
                <div class="stat-row"><span>${elemImg('fire')} Feu</span> <span>${fighter.elements.fire}</span></div>
                <div class="stat-row"><span>${elemImg('wood')} Bois</span> <span>${fighter.elements.wood}</span></div>
                <div class="stat-row"><span>${elemImg('water')} Eau</span> <span>${fighter.elements.water}</span></div>
                <div class="stat-row"><span>${elemImg('bolt')} Foudre</span> <span>${fighter.elements.bolt}</span></div>
                <div class="stat-row"><span>${elemImg('air')} Air</span> <span>${fighter.elements.air}</span></div>
            </div>
            <div class="sheet-col">
                <h4>Stats Globales</h4>
                <div class="stat-row"><span>❤️ Points de Vie</span> <span>${fighter.stats.life}</span></div>
                <div class="stat-row"><span>⚡ Vitesse</span> <span>${fighter.stats.speed}</span></div>
                <div class="stat-row"><span>⏱️ Initiative</span> <span>${fighter.stats.initiative}</span></div>
                <div class="stat-row"><span>🛡️ Armure</span> <span>${fighter.stats.armor}%</span></div>
                <div class="stat-row"><span>⚔️ Contre</span> <span>${fighter.stats.counter}%</span></div>
                <div class="stat-row"><span>🏃 Esquive</span> <span>${fighter.stats.esquive}%</span></div>
                <div class="stat-row"><span>💨 S-Esquive</span> <span>${fighter.stats.superEsquive}%</span></div>
                <div class="stat-row"><span>🔄 Multi-coups</span> <span>${fighter.stats.multiHit}%</span></div>
            </div>
        </div>
        <div style="margin-top:15px">
            <h4>Compétences Apprises</h4>
            <div class="skill-list">${fighter.allSkills.map(s => `<span class="skill-tag" title="${s.description || ''}">${s.name}</span>`).join('')}</div>
        </div>
    `;
    document.getElementById(containerId).innerHTML = html;
}

window.toggleShield = function (team) {
    if (team === 'A') {
        state.shieldA = !state.shieldA;
        document.getElementById('btn-shield-a').classList.toggle('active', state.shieldA);
    } else {
        state.shieldB = !state.shieldB;
        document.getElementById('btn-shield-b').classList.toggle('active', state.shieldB);
    }
    renderMode1Panels();
};

function buildStatsHtml(dinoz, adverseTeam) {
    let html = '';
    const elementsOrd = ['fire', 'wood', 'water', 'bolt', 'air'];
    const elemImg = (key) => `<img src="/img/elements/${key === 'bolt' ? 'lightning' : key}.webp" style="width:16px;height:16px;vertical-align:middle;margin-right:4px;">`;
    const elementsLabels = { fire: elemImg('fire') + 'Feu', wood: elemImg('wood') + 'Bois', water: elemImg('water') + 'Eau', bolt: elemImg('bolt') + 'Foudre', air: elemImg('air') + 'Air' };

    html += `<div class="section-title"><i class="fas fa-swords"></i> Analyse Offensive</div>
             <table class="stats-table">
               <thead><tr><th>Action</th>${adverseTeam.map(t => `<th>${t.name}</th>`).join('')}</tr></thead>
               <tbody>`;

    // 1. Assauts de base (On affiche tout, même si élément = 0)
    elementsOrd.forEach(el => {
        const skillMock = { name: 'Assaut', multipliers: { [elementsLabels[el].replace(/<.*?>/g, '')]: 5 }, effect: 'DAMAGE' };
        html += `<tr><td>Assaut ${elementsLabels[el]}</td>${adverseTeam.map(adv => `<td>${getOutput(dinoz, adv, skillMock, true)}</td>`).join('')}</tr>`;
    });

    // 2. Compétences A et E qui ont un impact sur les PV (HEAL ou DAMAGE uniquement)
    const HEAL_NAMES = ['Sieste', 'Aube Feuillue', 'Printemps Précoce', 'AubeFeuillue', 'PrintempsPrecoce', 'Printemps Precoce'];
    // Compétences à exclure explicitement du tableau
    const SKILLS_BLACKLIST = ['Trou Noir', 'Coups Sournois', 'Paume Ejectable', 'Coup Fatal'];

    const skillsToDisplay = (dinoz.allSkills || []).filter(fs => {
        if (SKILLS_BLACKLIST.includes(fs.name)) return false;
        if (fs.type !== 'A' && fs.type !== 'E') return false;
        return fs.effect === 'HEAL' || fs.effect === 'DAMAGE' || HEAL_NAMES.includes(fs.name);
    });

    skillsToDisplay.forEach(fullSkill => {
        const isHeal = fullSkill.effect === 'HEAL' || HEAL_NAMES.includes(fullSkill.name);
        const rowClass = isHeal ? 'row-heal' : '';
        const label = isHeal ? `<span class="heal-label">SOIN</span> ${fullSkill.name}` : fullSkill.name;
        html += `<tr class="${rowClass}"><td>${label}</td>${adverseTeam.map(adv => `<td>${getOutput(dinoz, adv, fullSkill, false)}</td>`).join('')}</tr>`;
    });

    html += `</tbody></table>`;
    return html;
}

function getOutput(attacker, target, skill, isAssault) {
    if (state.displayRange) {
        const min = calculateValue(attacker, target, skill, isAssault, 0); // 0% bonus
        const max = calculateValue(attacker, target, skill, isAssault, 1); // 30% bonus
        return `[${min} - ${max}]`;
    } else {
        return calculateValue(attacker, target, skill, isAssault, 0.5); // 15% bonus (moyenne)
    }
}

function calculateValue(attacker, target, skill, isAssault, randomVal) {
    const ELEM_MAP = { 'Feu': 'fire', 'Bois': 'wood', 'Eau': 'water', 'Foudre': 'bolt', 'Air': 'air' };
    const HEAL_NAMES = ['Sieste', 'Aube Feuillue', 'Printemps Précoce', 'AubeFeuillue', 'PrintempsPrecoce', 'Printemps Precoce'];
    const isHeal = skill.effect === 'HEAL' || HEAL_NAMES.includes(skill.name);

    const targetTeam = state.teamA.includes(target) ? 'A' : 'B';

    // Aura Hermétique : ×1.2 sur l'armure de la cible
    const targetShield = (targetTeam === 'A' ? state.shieldA : state.shieldB);
    const baseArmor = (target.statArmor || target.stats?.armor || 0);
    const effectiveArmor = targetShield ? (((1 + baseArmor / 100) * 1.2) - 1) * 100 : baseArmor;

    // Sieste : montant fixe [1 - 20], pas de bonus aléatoire
    if (skill.name === 'Sieste') {
        if (randomVal === 0) return 1;
        if (randomVal === 1) return 20;
        return Math.round((1 + 20) / 2); // Moyenne = 11
    }

    let power = 0;
    const multipliers = skill.multipliers || {};

    // Fallback de multiplicateurs pour les soins connus dont la DB est incomplète
    // Ces valeurs sont hardcodées selon les règles du jeu
    const HEAL_MULTIPLIER_FALLBACK = {
        'Printemps Précoce': { 'Bois': 1 },
        'PrintempsPrecoce': { 'Bois': 1 },
        'Printemps Precoce': { 'Bois': 1 },
        'Aube Feuillue': { 'Bois': 2, 'Foudre': 2 },
        'AubeFeuillue': { 'Bois': 2, 'Foudre': 2 }
    };
    const effectiveMults = (Object.keys(multipliers).length > 0)
        ? multipliers
        : (HEAL_MULTIPLIER_FALLBACK[skill.name] || {});

    // Calcul de la puissance de base (Somme des éléments × multiplicateurs)
    for (const [elemDb, multValue] of Object.entries(effectiveMults)) {
        const engKey = ELEM_MAP[elemDb] || elemDb.toLowerCase();
        const eleValue = attacker.elements?.[engKey] || attacker[`stat${engKey.charAt(0).toUpperCase() + engKey.slice(1)}`] || 0;
        power += eleValue * multValue;
    }

    // Minimum 1 de puissance
    power = Math.max(power, 1);

    if (isHeal) {
        // SOIN : Min = 1, Max = power (pas de bonus aléatoire pour les soins)
        const maxHeal = Math.round(power);
        if (randomVal === 0) return 1;
        if (randomVal === 1) return Math.max(maxHeal, 1);
        // Moyenne : milieu exact entre 1 et Max
        return Math.max(Math.round((1 + maxHeal) / 2), 1);
    } else {
        // DÉGÂTS : Nouvelle formule demandée

        // A. Ajout du bonus aléatoire (0% à 30%)
        const bonusFactor = 1 + (randomVal * 0.3);
        let currentDmg = power * bonusFactor;

        // B. Réduction par l'Armure (Ignorée par les Santaz)
        if (attacker.race !== 'Santaz') {
            currentDmg *= (1 - (effectiveArmor / 100));
        }

        // C. Réduction par la Défense (Liée à l'élément dominant ou moyenne ?)
        // On va chercher la défense correspondante aux multiplicateurs
        let defense = 0;
        let sumMults = 0;
        for (const [elemDb, multValue] of Object.entries(multipliers)) {
            const engKey = ELEM_MAP[elemDb] || elemDb.toLowerCase();
            const defVal = target.defenses?.[engKey === 'bolt' ? 'lightning' : engKey] || target[`def${engKey.charAt(0).toUpperCase() + engKey.slice(1)}`] || 0;
            defense += defVal * multValue;
            sumMults += multValue;
        }
        if (sumMults > 0) defense /= sumMults; // Moyenne pondérée par les pouvoirs

        currentDmg -= defense;

        // D. Puissance 0.6 et arrondi
        return Math.round(Math.pow(Math.max(currentDmg, 1), 0.6));
    }
}