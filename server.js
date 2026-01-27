// ==========================================
// 1. CONFIGURATION & IMPORTS
// ==========================================
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const session = require('express-session'); 
const bcrypt = require('bcrypt');
const { exec } = require('child_process');

const app = express();
const prisma = new PrismaClient();
const PORT = 3000;

// Configuration Express
app.set('view engine', 'ejs');
app.use(express.static('public')); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 

// Configuration Session
app.use(session({
    secret: 'shjs17fd6sfz$e^"uf5mzf,sofjcp"m!s;,:cksi', 
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 24 heures
}));

// Middleware de sécurité : Vérification Rôle LEADER
const checkLeader = async (req, res, next) => {
    if (!req.session.userId) return res.redirect('/login');
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
    if (user && user.role === 'LEADER') next();
    else res.redirect('/dashboard');
};

// ==========================================
// 2. AUTHENTIFICATION (Login / Logout)
// ==========================================

app.get('/', (req, res) => {
    req.session.userId ? res.redirect('/dashboard') : res.redirect('/login');
});

app.get('/login', (req, res) => res.render('login', { error: null }));

app.post('/login', async (req, res) => {
    const { pseudo, password } = req.body; 
    const user = await prisma.user.findUnique({ where: { pseudo } });

    if (!user) return res.render('login', { error: "Pseudo ou mot de passe incorrect." });

    // Vérification : Soit premier login (texte clair), soit login normal (hash)
    let isValid = false;
    if (user.firstLogin) {
        if (user.passwordHash === password) isValid = true;
    } else {
        isValid = await bcrypt.compare(password, user.passwordHash);
    }

    if (!isValid) return res.render('login', { error: "Pseudo ou mot de passe incorrect." });

    req.session.userId = user.id; 
    req.session.pseudo = user.pseudo; 

    if (user.firstLogin) return res.redirect('/change-password');
    res.redirect('/dashboard'); 
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

app.get('/change-password', (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    res.render('change-password', { error: null });
});

app.post('/change-password', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const { newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
        return res.render('change-password', { error: "Les mots de passe ne correspondent pas." });
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10); 
        await prisma.user.update({
            where: { id: req.session.userId },
            data: { passwordHash: hashedPassword, firstLogin: false }
        });
        res.redirect('/dashboard');
    } catch (error) {
        res.render('change-password', { error: "Erreur technique." });
    }
});

// ==========================================
// 3. TABLEAU DE BORD & UTILISATEUR
// ==========================================

app.get('/dashboard', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } });

    if (user.firstLogin) return res.redirect('/change-password');

    const daysMember = Math.ceil(Math.abs(new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24));
    res.render('dashboard', { pseudo: user.pseudo, role: user.role, daysMember });
});

app.post('/api/preference', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Non connecté' });
    const { key, value } = req.body;
    
    if (key === 'treeMode') {
        await prisma.user.update({
            where: { id: req.session.userId },
            data: { treeMode: value }
        });
        return res.json({ success: true });
    }
    res.status(400).json({ error: 'Champ invalide' });
});

// ==========================================
// 4. GESTION DES DINOZS (Vues & Actions)
// ==========================================

// Liste des Dinozs
app.get('/dinozs', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
    
    const dinozs = await prisma.dinoz.findMany({
        where: { userId: user.id },
        orderBy: { level: 'desc' }
    });
    
    const daysMember = Math.ceil(Math.abs(new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24));
    res.render('my-dinozs', { pseudo: user.pseudo, role: user.role, daysMember, dinozs });
});

// Détails d'un Dinoz
app.get('/dinoz/:id', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    
    try {
        const dino = await prisma.dinoz.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { learnedSkills: true, plan: true }
        });

        if (!dino || dino.userId !== req.session.userId) return res.redirect('/dinozs');

        const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
        const myPlans = await prisma.skillPlan.findMany({ where: { authorId: user.id }, orderBy: { name: 'asc' } });
        const allSkills = await prisma.refSkill.findMany({ include: { parents: { select: { id: true } } } });

        const daysMember = Math.ceil(Math.abs(new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24));
        const hasPDC = dino.learnedSkills.some(s => s.name === "Plan de Carrière");
        const hasReincarnationSkill = dino.learnedSkills.some(s => s.id === 41406);

        res.render('dinoz-details', { 
            dino, user, pseudo: user.pseudo, role: user.role, daysMember,
            allSkills, hasPDC, hasReincarnationSkill, myPlans 
        });
    } catch (error) {
        console.error(error);
        res.redirect('/dinozs');
    }
});

// Création Dinoz
app.post('/dinozs/create', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const { name, race, imageUrl, skinType } = req.body;
    
    try {
        const raceNameFormatted = race.charAt(0).toUpperCase() + race.slice(1).toLowerCase();
        const raceInfo = await prisma.refRace.findUnique({
            where: { name: raceNameFormatted },
            include: { innateSkill: true }
        });

        const stats = raceInfo ? {
            statFire: raceInfo.baseFire, statWood: raceInfo.baseWood, statWater: raceInfo.baseWater,
            statBolt: raceInfo.baseBolt, statAir: raceInfo.baseAir
        } : {};

        let skillsToConnect = raceInfo && raceInfo.innateSkill ? [{ id: raceInfo.innateSkill.id }] : [];

        await prisma.dinoz.create({
            data: {
                name, race, level: 1, userId: req.session.userId,
                imageUrl: (skinType !== 'default' && imageUrl) ? imageUrl : null,
                ...stats,
                learnedSkills: { connect: skillsToConnect }
            }
        });
        res.redirect('/dinozs');
    } catch (error) {
        console.error(error);
        res.redirect('/dinozs');
    }
});

// Suppression Dinoz
app.post('/dinozs/delete', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const { dinozId } = req.body;

    try {
        const dino = await prisma.dinoz.findUnique({ where: { id: parseInt(dinozId) } });
        if (dino && dino.userId === req.session.userId) {
            await prisma.dinoz.delete({ where: { id: parseInt(dinozId) } });
        }
        res.redirect('/dinozs');
    } catch (error) { console.error(error); res.redirect('/dinozs'); }
});

// Mise à jour de la grille (Logique principale)
app.post('/dinoz/update-grid', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Non connecté" });
    const { dinoId, rowIndex, colIndex, value } = req.body;

    try {
        const dino = await prisma.dinoz.findUnique({ where: { id: parseInt(dinoId) } });
        if (!dino || dino.userId !== req.session.userId) return res.status(403).json({ error: "Interdit" });

        // 1. Mise à jour JSON
        let gridData = dino.ups || {}; 
        if (!gridData[rowIndex]) gridData[rowIndex] = {}; 
        const colKey = `col${colIndex}`;
        
        value === "" ? delete gridData[rowIndex][colKey] : gridData[rowIndex][colKey] = value;

        // 2. Calcul Niveau
        let newLevel = 1;
        for (const [_, cols] of Object.entries(gridData)) {
            if (cols.col3 && cols.col3 !== "") newLevel++;
        }

        // 3. Calcul Stats & Compétences
        const raceInfo = await prisma.refRace.findUnique({ where: { name: dino.race } });
        
        let base = raceInfo ? {
            fire: raceInfo.baseFire, wood: raceInfo.baseWood, water: raceInfo.baseWater, 
            bolt: raceInfo.baseBolt, air: raceInfo.baseAir
        } : { fire: 0, wood: 0, water: 0, bolt: 0, air: 0 };

        let bonus = {
            fire: dino.bonusFire||0, wood: dino.bonusWood||0, water: dino.bonusWater||0,
            bolt: dino.bonusBolt||0, air: dino.bonusAir||0
        };

        let gridPoints = { fire: 0, wood: 0, water: 0, bolt: 0, air: 0 };
        const ELEM_TO_KEY = { 'Feu': 'fire', 'Bois': 'wood', 'Eau': 'water', 'Foudre': 'bolt', 'Air': 'air' };
        
        // Reconstruction des compétences
        let skillIdsToConnect = [];
        if (raceInfo?.innateSkillId) skillIdsToConnect.push({ id: raceInfo.innateSkillId });

        // On garde les sphères (Nature 3) déjà acquises
        const currentSkills = await prisma.dinoz.findUnique({
            where: { id: parseInt(dinoId) }, include: { learnedSkills: true }
        });
        currentSkills?.learnedSkills.forEach(s => {
            if (s.skillNature === 3 && !skillIdsToConnect.find(x => x.id === s.id)) {
                skillIdsToConnect.push({ id: s.id });
            }
        });

        // Scan de la grille
        for (const [_, cols] of Object.entries(gridData)) {
            if (cols.col3) {
                try {
                    const dec = JSON.parse(cols.col3);
                    if (dec.element && ELEM_TO_KEY[dec.element]) gridPoints[ELEM_TO_KEY[dec.element]]++;
                    if (dec.action === 'learn' && dec.skillId && !skillIdsToConnect.find(x => x.id === dec.skillId)) {
                        skillIdsToConnect.push({ id: dec.skillId });
                    }
                } catch (e) {}
            }
        }

        const finalStats = {
            statFire: base.fire + bonus.fire + gridPoints.fire,
            statWood: base.wood + bonus.wood + gridPoints.wood,
            statWater: base.water + bonus.water + gridPoints.water,
            statBolt: base.bolt + bonus.bolt + gridPoints.bolt,
            statAir: base.air + bonus.air + gridPoints.air
        };

        await prisma.dinoz.update({
            where: { id: parseInt(dinoId) },
            data: { 
                ups: gridData, level: newLevel, ...finalStats,
                learnedSkills: { set: skillIdsToConnect }
            }
        });

        res.json({ success: true, stats: finalStats, level: newLevel });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// Réincarnation
app.post('/dinoz/reincarnate', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Non connecté" });
    const { dinoId, bonuses } = req.body; 

    try {
        const dino = await prisma.dinoz.findUnique({ 
            where: { id: parseInt(dinoId) }, include: { learnedSkills: true } 
        });
        if (!dino || dino.userId !== req.session.userId) return res.status(403).json({ error: "Interdit" });

        const raceInfo = await prisma.refRace.findUnique({ where: { name: dino.race } });
        
        // On conserve la grille de tirage (col1/col2) mais on efface les décisions (col3)
        let newUps = {};
        if (dino.ups && typeof dino.ups === 'object') {
            for (const [row, cols] of Object.entries(dino.ups)) {
                newUps[row] = {};
                if (cols.col1) newUps[row].col1 = cols.col1;
                if (cols.col2) newUps[row].col2 = cols.col2;
            }
        }

        // Calcul stats de base + bonus choisis
        const base = raceInfo ? {
            fire: raceInfo.baseFire, wood: raceInfo.baseWood, water: raceInfo.baseWater, 
            bolt: raceInfo.baseBolt, air: raceInfo.baseAir
        } : { fire: 0, wood: 0, water: 0, bolt: 0, air: 0 };

        let skillsToKeep = raceInfo?.innateSkillId ? [{ id: raceInfo.innateSkillId }] : [];

        await prisma.dinoz.update({
            where: { id: parseInt(dinoId) },
            data: {
                level: 1, isReincarnate: 1, ups: newUps,
                bonusFire: bonuses.fire, bonusWood: bonuses.wood, bonusWater: bonuses.water, bonusBolt: bonuses.lightning, bonusAir: bonuses.air,
                statFire: base.fire + bonuses.fire, statWood: base.wood + bonuses.wood, statWater: base.water + bonuses.water, statBolt: base.bolt + bonuses.lightning, statAir: base.air + bonuses.air,
                sphereFire: 0, sphereWood: 0, sphereWater: 0, sphereBolt: 0, sphereAir: 0, sphereVoid: 0,
                learnedSkills: { set: skillsToKeep }
            }
        });
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// Ajout Sphère
app.post('/dinoz/add-sphere', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Non connecté" });
    const { dinoId, element } = req.body; 

    try {
        const dino = await prisma.dinoz.findUnique({ where: { id: parseInt(dinoId) } });
        if (!dino || dino.userId !== req.session.userId) return res.status(403).json({ error: "Interdit" });

        const SPHERE_COL_MAP = { 'fire': 'sphereFire', 'wood': 'sphereWood', 'water': 'sphereWater', 'bolt': 'sphereBolt', 'air': 'sphereAir', 'void': 'sphereVoid' };
        const ELEM_MAP_DB = { 'fire': 'Feu', 'wood': 'Bois', 'water': 'Eau', 'bolt': 'Foudre', 'air': 'Air', 'void': 'Vide' };

        const sphereField = SPHERE_COL_MAP[element];
        if (dino[sphereField] >= 3) return res.status(400).json({ error: "Max atteint." });

        const sphereSkills = await prisma.refSkill.findMany({
            where: { element: ELEM_MAP_DB[element], skillNature: 3 },
            orderBy: { id: 'asc' }
        });

        const skillToLearn = sphereSkills[dino[sphereField]];
        if (!skillToLearn) return res.status(404).json({ error: "Compétence non trouvée." });

        await prisma.dinoz.update({
            where: { id: parseInt(dinoId) },
            data: {
                [sphereField]: dino[sphereField] + 1,
                learnedSkills: { connect: { id: skillToLearn.id } }
            }
        });
        res.json({ success: true, skillName: skillToLearn.name });
    } catch (error) { console.error(error); res.status(500).json({ error: "Erreur serveur" }); }
});

// Assigner un Plan
app.post('/dinoz/assign-plan', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Non connecté" });
    const { dinoId, planId } = req.body; 

    try {
        const dino = await prisma.dinoz.findUnique({ where: { id: parseInt(dinoId) } });
        if (!dino || dino.userId !== req.session.userId) return res.status(403).json({ error: "Interdit" });

        await prisma.dinoz.update({
            where: { id: parseInt(dinoId) },
            data: { planId: planId ? parseInt(planId) : null }
        });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Erreur serveur" }); }
});

// ==========================================
// 5. GESTION DES PLANS & ARCHITECTE
// ==========================================

// Visualiseur Arbres
app.get('/arbres', async (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
    const allSkills = await prisma.refSkill.findMany({
        include: { parents: { select: { id: true } }, children: { select: { id: true } } }
    });
    
    const daysMember = Math.ceil(Math.abs(new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24));
    res.render('arbres', { user, pseudo: user.pseudo, role: user.role, daysMember, skills: allSkills, userTreeMode: user.treeMode || "COMPRESSED" });
});

// Page Architecte (Création/Edition)
app.get('/architecte', async (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } });

    const allSkills = await prisma.refSkill.findMany({
        include: { parents: { select: { id: true } }, children: { select: { id: true } } },
        orderBy: { id: 'asc' }
    });

    const raceList = ['castivore', 'gorilloz', 'hippoclamp', 'moueffe', 'nuagoz', 'pigmou', 'planaille', 'pteroz', 'rocky', 'sirain', 'wanwan', 'winks', 'feross', 'kabuki', 'mahamuti', 'quetzu', 'santaz', 'smog', 'soufflet', 'toufufu', 'triceragnon'].sort();

    let planToEdit = null;
    if (req.query.id) {
        const existingPlan = await prisma.skillPlan.findUnique({ where: { id: parseInt(req.query.id) } });
        if (existingPlan && existingPlan.authorId === user.id) planToEdit = existingPlan;
    }

    const daysMember = Math.ceil(Math.abs(new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24));
    res.render('architecte', { user, pseudo: user.pseudo, role: user.role, skills: allSkills, daysMember, raceList, plan: planToEdit });
});

// Sauvegarder un plan
app.post('/architecte/save', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Non connecté' });
    const { id, name, race, isPublic, selectedSkillIds, level } = req.body;

    try {
        const data = {
            name: name.trim() || 'Plan sans nom',
            race, isPublic: isPublic === true || isPublic === 'true',
            skillIds: selectedSkillIds, level: parseInt(level) || 1,
            originalAuthor: null // Si modifié, je deviens l'auteur principal
        };

        if (id) {
            const existing = await prisma.skillPlan.findUnique({ where: { id: parseInt(id) } });
            if (!existing || existing.authorId !== req.session.userId) return res.status(403).json({ error: "Ce plan ne vous appartient pas." });
            await prisma.skillPlan.update({ where: { id: parseInt(id) }, data });
        } else {
            await prisma.skillPlan.create({ data: { ...data, authorId: req.session.userId } });
        }
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: "Erreur sauvegarde." }); }
});

// Liste Mes Plans
app.get('/plans', async (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
    
    const myPlans = await prisma.skillPlan.findMany({
        where: { authorId: user.id }, orderBy: { createdAt: 'desc' },
        include: { author: { select: { pseudo: true } } }
    });
    
    const daysMember = Math.ceil(Math.abs(new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24));
    res.render('plans', { user, pseudo: user.pseudo, role: user.role, daysMember, plans: myPlans });
});

// Liste Plans Clan
app.get('/clan/plans', async (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } });

    const clanPlans = await prisma.skillPlan.findMany({
        where: { isPublic: true }, orderBy: { createdAt: 'desc' },
        include: { author: { select: { pseudo: true } } }
    });

    const daysMember = Math.ceil(Math.abs(new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24));
    res.render('clan-plans', { user, pseudo: user.pseudo, role: user.role, daysMember, plans: clanPlans });
});

// Détails Plan
app.get('/plan/:id', async (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
    
    const plan = await prisma.skillPlan.findUnique({ 
        where: { id: parseInt(req.params.id) },
        include: { author: { select: { pseudo: true, id: true } } }
    });

    if (!plan) return res.redirect('/plans');

    const allSkills = await prisma.refSkill.findMany({
        include: { parents: { select: { id: true } }, children: { select: { id: true } } },
        orderBy: { id: 'asc' }
    });

    const daysMember = Math.ceil(Math.abs(new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24));
    res.render('plan-details', { user, pseudo: user.pseudo, role: user.role, daysMember, plan, skills: allSkills });
});

// Supprimer Plan
app.post('/plan/delete', async (req, res) => {
    if (!req.session.userId) return res.status(403).json({ error: "Non connecté" });
    const { planId } = req.body;

    try {
        const plan = await prisma.skillPlan.findUnique({ where: { id: parseInt(planId) } });
        const user = await prisma.user.findUnique({ where: { id: req.session.userId } });

        if (plan.authorId !== user.id && user.role !== 'LEADER') return res.status(403).json({ error: "Interdit" });

        await prisma.skillPlan.delete({ where: { id: parseInt(planId) } });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Erreur serveur" }); }
});

// Cloner Plan
app.post('/plan/clone', async (req, res) => {
    if (!req.session.userId) return res.status(403).json({ error: "Non connecté" });
    const { planId } = req.body;

    try {
        const original = await prisma.skillPlan.findUnique({ where: { id: parseInt(planId) }, include: { author: true } });
        if (!original) return res.status(404).json({ error: "Plan introuvable" });

        await prisma.skillPlan.create({
            data: {
                name: original.name, race: original.race, skillIds: original.skillIds, level: original.level,
                isPublic: false, authorId: req.session.userId,
                originalAuthor: original.originalAuthor || original.author.pseudo
            }
        });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Erreur serveur" }); }
});

// ==========================================
// 6. ADMINISTRATION
// ==========================================

app.get('/admin', checkLeader, async (req, res) => {
    const users = await prisma.user.findMany({ orderBy: { id: 'asc' } });
    const currentUser = await prisma.user.findUnique({ where: { id: req.session.userId } });
    res.render('admin', { users, currentUser });
});

app.post('/admin/create-user', checkLeader, async (req, res) => {
    const { pseudo, password, role } = req.body;
    try {
        // Création avec mot de passe en clair pour le premier login
        await prisma.user.create({
            data: { pseudo, passwordHash: password, role, firstLogin: true }
        });
        res.redirect('/admin');
    } catch (error) { res.redirect('/admin'); }
});

app.post('/admin/delete-user', checkLeader, async (req, res) => {
    const userId = parseInt(req.body.userId);
    if (userId === req.session.userId) return res.redirect('/admin');

    try {
        await prisma.dinoz.deleteMany({ where: { userId } });
        await prisma.skillPlan.deleteMany({ where: { authorId: userId } });
        await prisma.user.delete({ where: { id: userId } });
        res.redirect('/admin');
    } catch (error) { res.redirect('/admin'); }
});

app.post('/admin/update-role', checkLeader, async (req, res) => {
    const userId = parseInt(req.body.userId);
    if (userId === req.session.userId) return res.redirect('/admin');
    try {
        await prisma.user.update({ where: { id: userId }, data: { role: req.body.newRole } });
        res.redirect('/admin');
    } catch (error) { res.redirect('/admin'); }
});

app.post('/admin/reset-dinozs', checkLeader, async (req, res) => {
    try {
        await prisma.dinoz.deleteMany({});
        console.log("⚠️ TOUS LES DINOZS SUPPRIMÉS (RAZ ADMIN)");
        res.redirect('/admin');
    } catch (error) { res.redirect('/admin'); }
});

app.post('/admin/sync-skills', checkLeader, (req, res) => {
    exec('node scripts/sync-skills.js', (err, out) => {
        if (err) return res.redirect('/admin');
        console.log(`Skills sync: ${out}`);
        
        exec('node scripts/sync-races.js', (err2, out2) => {
            if (err2) return res.redirect('/admin');
            console.log(`Races sync: ${out2}`);
            res.redirect('/admin');
        });
    });
});

// ==========================================
// 7. DÉMARRAGE SERVEUR
// ==========================================
app.listen(PORT, () => {
    console.log(`❄️  Serveur Guerriers du Givre lancé sur http://localhost:${PORT}`);
});