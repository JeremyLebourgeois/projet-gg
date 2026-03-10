let DINOZ_DATA, PLAN_DATA, SKILLS_DATA, RACES_DATA;

const state = {
    fighters: [],
    teamA: [],
    teamB: [],
    activeA: 0,
    activeB: 0,
    shieldA: false,
    shieldB: false,
    displayRange: false
};

// Constantes de combat (Exactes selon getDamage.ts)
const BASE_ATTACK_VALUE = 2;
const BASE_DEFENSE_VALUE = 0;
const ASSAULT_POWER = 5;
const ATTACK_GLOBAL_FACTOR = 1.0;

const SKILLS_POWER = {
    'Souffle Ardent': 5,
    'Boule de Feu': 7,
    'Météores': 10,
    'Coulée de Lave': 12,
    'Combustion': 3,
    'Paume Chalumeau': 10,
    'Canon à Eau': 6,
    'Douche Écossaise': 2,
    'Gel': 5,
    'Déluge': 10,
    'Coup Sournois': 7,
    'Lanceur de Gland': 5,
    'Ondine': 30,
    'Loup-Garou': 30,
    'Éclair': 5,
    'Danse Foudroyante': 3,
    'Foudre': 10,
    'Crépuscule Flamboyant': 6,
    'Mistral': 3,
    'Tornade': 5,
    'Attaque Plongeante': 5,
    'Envol': 10,
    'Disque Vacuum': 12
};


document.addEventListener('DOMContentLoaded', () => {
    initData();
    populateFilters();
    buildFightersList();
    attachEventListeners();
});

function initData() {
    DINOZ_DATA = JSON.parse(document.getElementById('dinoz-data').textContent || '[]');
    PLAN_DATA = JSON.parse(document.getElementById('plan-data').textContent || '[]');
    SKILLS_DATA = JSON.parse(document.getElementById('skills-data').textContent || '[]');
    RACES_DATA = JSON.parse(document.getElementById('races-data').textContent || '[]');

    DINOZ_DATA.forEach(d => state.fighters.push(buildFighterStats(d, false)));
    PLAN_DATA.forEach(p => state.fighters.push(buildFighterStats(p, true)));

    state.fighters.sort((a, b) => b.level - a.level);
}

function calculateDefenses(elements, defRatios, defMods) {
    const fire = elements.statFire || 0;
    const wood = elements.statWood || 0;
    const water = elements.statWater || 0;
    const bolt = elements.statBolt || elements.statLightning || 0;
    const air = elements.statAir || 0;

    return {
        fire: parseFloat((((fire + defRatios.fire) * 1) + ((wood + defRatios.wood) * 0.5) + ((water + defRatios.water) * 0.5) + ((bolt + defRatios.bolt) * 1.5) + ((air + defRatios.air) * 1.5) + defMods.fire).toFixed(1)),
        wood: parseFloat((((fire + defRatios.fire) * 1.5) + ((wood + defRatios.wood) * 1) + ((water + defRatios.water) * 0.5) + ((bolt + defRatios.bolt) * 0.5) + ((air + defRatios.air) * 1.5) + defMods.wood).toFixed(1)),
        water: parseFloat((((fire + defRatios.fire) * 1.5) + ((wood + defRatios.wood) * 1.5) + ((water + defRatios.water) * 1) + ((bolt + defRatios.bolt) * 0.5) + ((air + defRatios.air) * 0.5) + defMods.water).toFixed(1)),
        lightning: parseFloat((((fire + defRatios.fire) * 0.5) + ((wood + defRatios.wood) * 1.5) + ((water + defRatios.water) * 1.5) + ((bolt + defRatios.bolt) * 1) + ((air + defRatios.air) * 0.5) + defMods.bolt).toFixed(1)),
        air: parseFloat((((fire + defRatios.fire) * 0.5) + ((wood + defRatios.wood) * 0.5) + ((water + defRatios.water) * 1.5) + ((bolt + defRatios.bolt) * 1.5) + ((air + defRatios.air) * 1) + defMods.air).toFixed(1))
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

        // Éléments (uniquement pour les Fantômes "Plans", car les "Dinozs" ont déjà ces bonus sauvegardés en BDD depuis server.js)
        else if (isGhost && key === 'FIRE_ELEMENT') flatStats.statFire += amount;
        else if (isGhost && key === 'WOOD_ELEMENT') flatStats.statWood += amount;
        else if (isGhost && key === 'WATER_ELEMENT') flatStats.statWater += amount;
        else if (isGhost && key === 'LIGHTNING_ELEMENT') flatStats.statBolt += amount;
        else if (isGhost && key === 'AIR_ELEMENT') flatStats.statAir += amount;

        // Types spécifiques aux combats
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

function buildFighterStats(data, isGhost) {
    const uniqueId = (isGhost ? 'ghost_' : 'real_') + data.id;
    let skillIds = [];
    let ajout = { fire: 0, wood: 0, water: 0, lightning: 0, air: 0 };
    let raceName = data.race;

    if (!isGhost) {
        skillIds = (data.learnedSkills || []).map(s => s.id);
        ajout = { fire: 0, wood: 0, water: 0, lightning: 0, air: 0 };
    } else {
        try { skillIds = (typeof data.skillIds === 'string' ? JSON.parse(data.skillIds) : data.skillIds) || []; } catch (e) { }
        try {
            let aj = (typeof data.ajout === 'string' ? JSON.parse(data.ajout) : data.ajout) || {};
            ajout = { fire: aj.fire || 0, wood: aj.wood || 0, water: aj.water || 0, lightning: aj.lightning || 0, air: aj.air || 0 };
        } catch (e) { }
    }

    const raceInfo = RACES_DATA.find(r => r.name.toLowerCase() === raceName.toLowerCase());
    const base = raceInfo ? { fire: raceInfo.baseFire, wood: raceInfo.baseWood, water: raceInfo.baseWater, bolt: raceInfo.baseBolt, air: raceInfo.baseAir } : { fire: 0, wood: 0, water: 0, bolt: 0, air: 0 };

    let flatStats = {
        statLife: 100, statArmor: 0, statInitiative: 0, statSpeed: 10, statCounter: 0, statEsquive: 0, statSuperEsquive: 0, statMultiHit: 0,
        statFire: base.fire + ajout.fire,
        statWood: base.wood + ajout.wood,
        statWater: base.water + ajout.water,
        statBolt: base.bolt + (ajout.lightning || 0),
        statAir: base.air + ajout.air,
        statAssaultFire: 0, statAssaultWood: 0, statAssaultWater: 0, statAssaultBolt: 0, statAssaultAir: 0,
        defFire: 0, defWood: 0, defWater: 0, defBolt: 0, defAir: 0,
        defRatioFire: 0, defRatioWood: 0, defRatioWater: 0, defRatioBolt: 0, defRatioAir: 0,
        resilience: 40  // Default resilience for Dinoz (getFighters.ts line 107)
    };

    let mults = { statArmor: 1.0, statLife: 1.0, statInitiative: 1.0, statSpeed: 1.0, statCounter: 1.0, statEsquive: 1.0, statSuperEsquive: 1.0, statMultiHit: 1.0 };

    if (isGhost) {
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
    } else {
        flatStats.statFire = data.statFire;
        flatStats.statWood = data.statWood;
        flatStats.statWater = data.statWater;
        flatStats.statBolt = data.statBolt;
        flatStats.statAir = data.statAir;
    }

    if (raceInfo && raceInfo.innateSkillId) {
        const innate = SKILLS_DATA.find(s => s.id === raceInfo.innateSkillId);
        if (innate && innate.modifiers) applyModifiersFighter(innate.modifiers, flatStats, mults, isGhost);
    }

    let attacks = [];
    let allSkills = [];
    skillIds.forEach(id => {
        const skill = SKILLS_DATA.find(s => s.id === id);
        if (skill) {
            allSkills.push(skill);
            if (skill.modifiers) applyModifiersFighter(skill.modifiers, flatStats, mults, isGhost);
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

    let defRatios = { fire: flatStats.defRatioFire, wood: flatStats.defRatioWood, water: flatStats.defRatioWater, bolt: flatStats.defRatioBolt, air: flatStats.defRatioAir };
    let defMods = { fire: flatStats.defFire, wood: flatStats.defWood, water: flatStats.defWater, bolt: flatStats.defBolt, air: flatStats.defAir };

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
        stats: data.stats && Object.keys(data.stats).length > 0 ? {
            armor: data.stats.statArmor || 0,
            life: data.stats.statLife || 100,
            initiative: data.stats.statInitiative || 0,
            speed: data.stats.statSpeed || 10,
            counter: data.stats.statCounter || 0,
            esquive: data.stats.statEsquive || 0,
            superEsquive: data.stats.statSuperEsquive || 0,
            multiHit: data.stats.statMultiHit || 0,
            resilience: flatStats.resilience
        } : {
            armor: finalArmor, life: finalLife, initiative: finalInitiative, speed: finalSpeed,
            counter: finalCounter, esquive: finalEsquive, superEsquive: finalSuperEsquive, multiHit: finalMultiHit,
            resilience: flatStats.resilience
        },
        elements: data.elements && Object.keys(data.elements).length > 0 ? {
            fire: data.elements.fire || 0, wood: data.elements.wood || 0, water: data.elements.water || 0, bolt: data.elements.bolt || 0, air: data.elements.air || 0
        } : {
            fire: flatStats.statFire, wood: flatStats.statWood, water: flatStats.statWater, bolt: flatStats.statBolt, air: flatStats.statAir
        },
        assaultBonus: {
            fire: flatStats.statAssaultFire, wood: flatStats.statAssaultWood, water: flatStats.statAssaultWater, bolt: flatStats.statAssaultBolt, air: flatStats.statAssaultAir
        },
        defenses: calculateDefenses(flatStats, defRatios, defMods),
        attacks: attacks,
        allSkills: allSkills
    };
}

function populateFilters() {
    let races = new Set();
    let players = new Set();
    state.fighters.forEach(f => {
        if (f.race) races.add(f.race);
        if (f.player) players.add(f.player);
    });

    const populateSelect = (id, items) => {
        const sel = document.getElementById(id);
        Array.from(items).sort().forEach(item => {
            const opt = document.createElement('option');
            opt.value = opt.textContent = item;
            sel.appendChild(opt);
        });
    };
    populateSelect('filter-race', races);
    populateSelect('filter-player', players);
}

function attachEventListeners() {
    ['filter-type', 'filter-race', 'filter-level-min', 'filter-level-max', 'filter-player', 'filter-role'].forEach(id => {
        document.getElementById(id).addEventListener('change', buildFightersList);
        if (id.includes('level')) document.getElementById(id).addEventListener('input', buildFightersList);
    });

    document.getElementById('btn-clear-a').addEventListener('click', () => { state.teamA = []; updateTeamsDOM(); });
    document.getElementById('btn-clear-b').addEventListener('click', () => { state.teamB = []; updateTeamsDOM(); });

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

    document.getElementById('select-active-a').addEventListener('change', (e) => { state.activeA = parseInt(e.target.value); renderMode1Panels(); });
    document.getElementById('select-active-b').addEventListener('change', (e) => { state.activeB = parseInt(e.target.value); renderMode1Panels(); });

    document.getElementById('shield-toggle-a').addEventListener('change', (e) => { state.shieldA = e.target.checked; renderMode1Panels(); });
    document.getElementById('shield-toggle-b').addEventListener('change', (e) => { state.shieldB = e.target.checked; renderMode1Panels(); });
}

function buildFightersList() {
    const type = document.getElementById('filter-type').value;
    const race = document.getElementById('filter-race').value;
    const minLvl = parseInt(document.getElementById('filter-level-min').value) || 1;
    const maxLvl = parseInt(document.getElementById('filter-level-max').value) || 80;
    const player = document.getElementById('filter-player').value;
    const role = document.getElementById('filter-role').value;

    const listContainer = document.getElementById('fighter-list-container');
    listContainer.innerHTML = '';

    const filtered = state.fighters.filter(f => {
        if (type !== 'all' && (type === 'real' ? f.isGhost : !f.isGhost)) return false;
        if (race !== 'all' && f.race !== race) return false;
        if (f.level < minLvl || f.level > maxLvl) return false;
        if (player !== 'all' && f.player !== player) return false;
        if (role !== 'all' && f.role !== role) return false;
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
        div.dataset.uid = f.uid;
        div.innerHTML = `
            <div class="fighter-info">
                <span class="badge ${f.isGhost ? 'ghost' : 'real'}">${f.isGhost ? 'Fantôme' : 'Dinoz'}</span>
                <img src="${f.imageUrl}" style="width: 90px; height: 90px; border-radius: 10px; margin: 6px auto; display: block; object-fit: contain;">
                <div class="fighter-name">${f.name}</div>
                <div class="fighter-details">Lvl ${f.level} - ${f.race}</div>
            </div>
            <div class="fighter-actions">
                <button class="btn-add-team btn-a ${inA ? 'in-team' : ''}" onclick="toggleTeam('${f.uid}', 'A', this)">${inA ? '− A' : '+ A'}</button>
                <button class="btn-add-team btn-b ${inB ? 'in-team' : ''}" onclick="toggleTeam('${f.uid}', 'B', this)">${inB ? '− B' : '+ B'}</button>
            </div>
        `;

        // Skill tooltip
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

window.addToTeam = function (uid, teamCode) {
    const f = state.fighters.find(x => x.uid === uid);
    if (!f) return;
    const fighterCopy = { ...f, id_team: Date.now() };
    if (teamCode === 'A' && state.teamA.length < 6) state.teamA.push(fighterCopy);
    else if (teamCode === 'B' && state.teamB.length < 6) state.teamB.push(fighterCopy);
    updateTeamsDOM();
};

window.toggleTeam = function (uid, teamCode, btn) {
    const team = teamCode === 'A' ? state.teamA : state.teamB;
    const existing = team.findIndex(x => x.uid === uid);
    if (existing >= 0) {
        // Remove from team
        team.splice(existing, 1);
        btn.textContent = `+ ${teamCode}`;
        btn.classList.remove('in-team');
    } else {
        // Add to team if not full
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

// ------ MODE 1 ENGINE ------

function startMode1() {
    state.activeA = 0; state.activeB = 0;
    state.shieldA = false; state.shieldB = false;
    document.getElementById('shield-toggle-a').checked = false;
    document.getElementById('shield-toggle-b').checked = false;
    const populateSelect = (id, team) => {
        document.getElementById(id).innerHTML = team.map((f, i) => `<option value="${i}">${f.name} (Lvl ${f.level})</option>`).join('');
    };
    populateSelect('select-active-a', state.teamA);
    populateSelect('select-active-b', state.teamB);
    renderMode1Panels();
}

function renderMode1Panels() {
    const fA = state.teamA[state.activeA];
    const fB = state.teamB[state.activeB];
    if (!fA || !fB) return;
    document.getElementById('stats-container-a').innerHTML = buildStatsHtml(fA, state.teamB, state.shieldA, state.shieldB);
    document.getElementById('stats-container-b').innerHTML = buildStatsHtml(fB, state.teamA, state.shieldB, state.shieldA);
    renderFighterSheet('sheet-a', fA);
    renderFighterSheet('sheet-b', fB);
}

function damageFormula(attacker, target, elementKey, power, isAssault, targetShield, randomVal) {
    // Step 1: base attack = BASE_ATTACK_VALUE + element * power
    // (Matches getDamage.ts: getAttackDefense loop)
    let attack = BASE_ATTACK_VALUE;
    const elementAttack = attacker.elements[elementKey] * power;
    attack += elementAttack;

    let defKey = elementKey === 'bolt' ? 'lightning' : elementKey;
    let defense = BASE_DEFENSE_VALUE;

    if (elementAttack > 0) {
        // defense = target.defense[ele] * att / sum_of_elements
        // For a single element: defense = target.defense[ele] * elementAttack / elementAttack = target.defense[ele]
        // BUT multiplied by att first: defense += target.defense[ele] * elementAttack
        // then divided by sum_of_elements (= elementAttack for single element)
        // => net result: defense = target.defenses[defKey]
        defense += (target.defenses[defKey] || 0);
        // Add assault bonus or skill elemental bonus
        attack += isAssault ? (attacker.assaultBonus[elementKey] || 0) : 0;
    }

    // Step 2: Apply random bonus (0 to 33% of current attack)
    attack += (randomVal * attack) / 3;

    // Step 3: Apply global factor
    attack *= ATTACK_GLOBAL_FACTOR;

    // Step 4: damage = attack
    let damage = attack;

    // Step 5: Apply armor (and shield bonus)
    // armor% = (target.stats.armor + shield_bonus) / 100
    let armorValue = ((target.stats.armor || 0) + (targetShield ? 20 : 0)) / 100;
    damage *= (1 - Math.max(0, armorValue));

    // Step 6: Subtract defense
    damage -= defense;

    // Step 7: Apply resilience (getDamage.ts line 24 uses Math.max(damage, 0))
    // factor: 1 - resilience*0.01, clamped to [0.5, 1.1]
    let resilienceFactor = Math.max(Math.min(1 - target.stats.resilience * 0.01, 1.1), 0.5);
    damage = Math.round(Math.pow(Math.max(damage, 0), resilienceFactor));

    // Step 8: Apply minimum damage (minDamage = 1 by default)
    return Math.max(damage, 1);
}

function getOutput(attacker, target, el, p, isa, tS) {
    if (state.displayRange) {
        const min = damageFormula(attacker, target, el, p, isa, tS, 0);
        const max = damageFormula(attacker, target, el, p, isa, tS, 1);
        return `[${min} - ${max}]`;
    } else {
        return damageFormula(attacker, target, el, p, isa, tS, 0.5);
    }
}

function renderFighterSheet(containerId, fighter) {
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

function buildStatsHtml(dinoz, adverseTeam, myShield, advShield) {
    let html = '';
    const elementsOrd = ['fire', 'wood', 'water', 'bolt', 'air'];
    const elemImg = (key) => `<img src="/img/elements/${key === 'bolt' ? 'lightning' : key}.webp" style="width:16px;height:16px;vertical-align:middle;margin-right:4px;">`;
    const elementsLabels = { fire: elemImg('fire') + 'Feu', wood: elemImg('wood') + 'Bois', water: elemImg('water') + 'Eau', bolt: elemImg('bolt') + 'Foudre', air: elemImg('air') + 'Air' };

    html += `<div class="section-title"><i class="fas fa-swords"></i> Dégâts Infligés</div>
             <table class="stats-table">
               <thead><tr><th>Attaque</th>${adverseTeam.map(t => `<th>${t.name}</th>`).join('')}</tr></thead>
               <tbody>`;
    elementsOrd.forEach(el => {
        if (dinoz.elements[el] <= 0 && el !== 'fire') return;
        html += `<tr><td>Assaut ${elementsLabels[el]}</td>${adverseTeam.map(adv => `<td>${getOutput(dinoz, adv, el, ASSAULT_POWER, true, advShield)}</td>`).join('')}</tr>`;
    });
    dinoz.attacks.forEach(atk => {
        const elKey = { 'Feu': 'fire', 'Bois': 'wood', 'Eau': 'water', 'Foudre': 'bolt', 'Air': 'air' }[atk.element];
        const power = SKILLS_POWER[atk.name] || 5;
        html += `<tr><td>${atk.name}</td>${adverseTeam.map(adv => `<td>${getOutput(dinoz, adv, elKey, power, false, advShield)}</td>`).join('')}</tr>`;
    });
    html += `</tbody></table>`;

    html += `<div class="section-title"><i class="fas fa-shield-alt"></i> Dégâts Subis</div>
             <table class="stats-table">
               <thead><tr><th>Attaque Adverse</th>${adverseTeam.map(t => `<th>De: ${t.name}</th>`).join('')}</tr></thead>
               <tbody>`;
    let allAdvAssaults = new Set();
    let allAdvSkills = new Map();
    adverseTeam.forEach(adv => {
        elementsOrd.forEach(el => { if (adv.elements[el] > 0) allAdvAssaults.add(el); });
        adv.attacks.forEach(atk => allAdvSkills.set(atk.id, atk));
    });
    Array.from(allAdvAssaults).forEach(el => {
        html += `<tr><td>Assaut ${elementsLabels[el]}</td>${adverseTeam.map(adv => adv.elements[el] > 0 ? `<td>${getOutput(adv, dinoz, el, ASSAULT_POWER, true, myShield)}</td>` : '<td>-</td>').join('')}</tr>`;
    });
    allAdvSkills.forEach(atk => {
        const elKey = { 'Feu': 'fire', 'Bois': 'wood', 'Eau': 'water', 'Foudre': 'bolt', 'Air': 'air' }[atk.element];
        const power = SKILLS_POWER[atk.name] || 5;
        html += `<tr><td>${atk.name}</td>${adverseTeam.map(adv => adv.attacks.some(a => a.id === atk.id) ? `<td>${getOutput(adv, dinoz, elKey, power, false, myShield)}</td>` : '<td>-</td>').join('')}</tr>`;
    });
    html += `</tbody></table>`;
    return html;
}