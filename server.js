// 1. On importe les outils
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const session = require('express-session'); 
const bcrypt = require('bcrypt');
const { exec } = require('child_process');
const RACES_DATA = require('./data/racesData');


// 2. On configure le serveur
const app = express();
app.use(express.json()); // Indispensable pour lire les fetch() en JSON
app.use(express.urlencoded({ extended: true })); // Indispensable pour lire les formulaires classiques
const prisma = new PrismaClient();
const PORT = 3000;

// Configuration de la session (Cookie)
// ⚠️ N'oublie pas d'avoir ta propre clé secrète sécurisée !
app.use(session({
    secret: 'shjs17fd6sfz$e^"uf5mzf,sofjcp"m!s;,:cksi', 
    resave: false,
    saveUninitialized: false,
    cookie: { 
        // Cookie valide pendant 24 heures (1 jour). C'est la base de la persistance simple.
        maxAge: 1000 * 60 * 60 * 24 
    }
}));

// Configurer EJS pour l'affichage (HTML)
app.set('view engine', 'ejs');
app.use(express.static('public')); // Dossier pour les images/CSS
app.use(express.urlencoded({ extended: true })); // Pour lire les formulaires (pseudo, password)

// 3. Les Routes (Les pages du site)

// Route d'Accueil : redirige vers le tableau de bord si connecté, sinon vers le login
app.get('/', async (req, res) => {
    if (req.session.userId) {
        return res.redirect('/dashboard');
    }
    res.redirect('/login');
});


// Route : Affichage de la Page de Connexion (GET)
app.get('/login', (req, res) => {
    // On passe un objet 'error: null' pour que la page EJS n'affiche pas d'erreur au départ
    res.render('login', { error: null }); 
});


// Route : Gestion de la Connexion (POST)
app.post('/login', async (req, res) => {
    const { pseudo, password } = req.body; 

    const user = await prisma.user.findUnique({
        where: { pseudo: pseudo },
    });

    if (!user) {
        return res.render('login', { error: "Pseudo ou mot de passe incorrect." }); 
    }

    // --- LOGIQUE DE VÉRIFICATION HYBRIDE ---
    let passwordIsValid = false;

    if (user.firstLogin === true) {
        // Cas 1 : Première connexion (Mot de passe temporaire en clair)
        if (user.passwordHash === password) {
            passwordIsValid = true;
        }
    } else {
        // Cas 2 : Compte sécurisé (Mot de passe haché)
        // bcrypt compare le mot de passe entré avec le hash de la BDD
        passwordIsValid = await bcrypt.compare(password, user.passwordHash);
    }

    // Si le mot de passe est faux
    if (!passwordIsValid) {
        return res.render('login', { error: "Pseudo ou mot de passe incorrect." });
    }

    // --- SUITE NORMALE (SESSION) ---
    req.session.userId = user.id; 
    req.session.pseudo = user.pseudo; 

    if (user.firstLogin === true) {
        return res.redirect('/change-password');
    }
    
    res.redirect('/dashboard'); 
});



// Route : Tableau de Bord
app.get('/dashboard', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');

    // On récupère toutes les infos de l'utilisateur (date de création, role...)
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } });

    if (user && user.firstLogin) {
        return res.redirect('/change-password');
    }

    // Calcul du nombre de jours depuis l'inscription
    const now = new Date();
    const created = new Date(user.createdAt);
    const diffTime = Math.abs(now - created);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

    // On envoie tout à la vue
    res.render('dashboard', { 
        pseudo: user.pseudo,
        role: user.role, // ex: "membre" ou "admin"
        daysMember: diffDays // ex: 12
    });
});

// Route : Déconnexion
app.get('/logout', (req, res) => {
    // Détruit la session sur le serveur, ce qui invalide le cookie
    req.session.destroy(err => {
        if (err) {
            console.error("Erreur de déconnexion:", err);
        }
        res.redirect('/login'); 
    });
});

// Route : Afficher la page de changement de mot de passe
app.get('/change-password', async (req, res) => {
    // Sécurité : Il faut être connecté
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    res.render('change-password', { error: null });
});

// Route : Traiter le changement de mot de passe
app.post('/change-password', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');

    const { newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
        return res.render('change-password', { error: "Les mots de passe ne correspondent pas." });
    }

    try {
        // --- SÉCURITÉ : HACHAGE DU MOT DE PASSE ---
        // Le '10' est le "salt rounds" (la complexité du cryptage)
        const hashedPassword = await bcrypt.hash(newPassword, 10); 

        await prisma.user.update({
            where: { id: req.session.userId },
            data: { 
                passwordHash: hashedPassword, // ✅ On sauvegarde la version cryptée !
                firstLogin: false
            }
        });

        res.redirect('/dashboard');

    } catch (error) {
        console.error(error);
        res.render('change-password', { error: "Erreur technique." });
    }
});

// --- MIDDLEWARE DE SÉCURITÉ ADMIN ---
// Vérifie si l'utilisateur est connecté ET s'il est "LEADER"
const checkLeader = async (req, res, next) => {
    if (!req.session.userId) return res.redirect('/login');
    
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
    
    if (user && user.role === 'LEADER') {
        next(); // C'est bon, on passe à la suite
    } else {
        res.redirect('/dashboard'); // Pas autorisé -> retour maison
    }
};

// --- ROUTE : AFFICHER LA PAGE ADMIN ---
app.get('/admin', checkLeader, async (req, res) => {
    // On récupère la liste de tous les utilisateurs pour l'afficher
    // On les trie par ID pour que ce soit propre
    const users = await prisma.user.findMany({
        orderBy: { id: 'asc' }
    });

    // On récupère aussi l'utilisateur courant pour éviter qu'il ne se supprime lui-même
    const currentUser = await prisma.user.findUnique({ where: { id: req.session.userId } });

    res.render('admin', { users, currentUser });
});

// --- ROUTE : CRÉER UN UTILISATEUR (ADMIN) ---
app.post('/admin/create-user', checkLeader, async (req, res) => {
    const { pseudo, password, role } = req.body;

    try {
        // On hache le mot de passe (comme dans change-password)
        // Note : On met firstLogin: true pour qu'il puisse changer son mdp à la première connexion
        // Ou false si tu veux lui donner un mdp définitif. Ici je mets true par sécurité.
        
        // Si firstLogin est true, on stocke le mdp en clair ou haché ?
        // Dans ta logique de login actuelle :
        // Cas 1 (FirstLogin) -> compare passwordHash brut
        // Cas 2 (Normal) -> compare bcrypt
        
        // Pour simplifier l'admin : on va stocker le mdp en CLAIR (comme tu faisais au début)
        // et mettre firstLogin = true. Comme ça il devra le changer et ça deviendra haché.
        
        await prisma.user.create({
            data: {
                pseudo: pseudo,
                passwordHash: password, // En clair pour le premier login
                role: role,
                firstLogin: true
            }
        });

        res.redirect('/admin'); // On recharge la page pour voir le nouveau membre
    } catch (error) {
        console.error("Erreur création user:", error);
        // Si le pseudo existe déjà, Prisma va crier. On pourrait gérer l'erreur mieux mais restons simples.
        res.redirect('/admin'); 
    }
});

// --- ROUTE : SUPPRIMER UN UTILISATEUR ---
app.post('/admin/delete-user', checkLeader, async (req, res) => {
    const { userId } = req.body;

    // Sécurité : On ne peut pas se supprimer soi-même
    if (parseInt(userId) === req.session.userId) {
        return res.redirect('/admin');
    }

    try {
        // Attention : Il faut d'abord supprimer les Dinozs du joueur (Contrainte Clé Étrangère)
        // Prisma a une option "Cascade" dans le schema, mais faisons-le manuellement par sécurité
        await prisma.dinoz.deleteMany({
            where: { userId: parseInt(userId) }
        });

        // Puis on supprime le joueur
        await prisma.user.delete({
            where: { id: parseInt(userId) }
        });

        res.redirect('/admin');
    } catch (error) {
        console.error("Erreur suppression user:", error);
        res.redirect('/admin');
    }
});

// --- ROUTE : LANCER LE SCRIPT SYNC-SKILLS ---
app.post('/admin/sync-skills', checkLeader, (req, res) => {
    console.log("🔄 Lancement du script sync-skills...");

    // Exécute la commande 'node sync-skills.js' dans le dossier racine
    exec('node scripts/sync-skills.js', (error, stdout, stderr) => {
        if (error) {
            console.error(`❌ Erreur d'exécution : ${error.message}`);
            // Idéalement on enverrait une erreur à l'écran, mais pour l'instant on redirect
            return res.redirect('/admin'); 
        }
        if (stderr) {
            console.error(`⚠️ Stderr : ${stderr}`);
        }
        
        // Affiche le résultat du script dans la console du serveur
        console.log(`✅ Résultat :\n${stdout}`);
        
        // Retourne à la page admin une fois fini
        res.redirect('/admin');
    });
});

// --- ROUTE : RAZ SERVEUR (SUPPRIMER TOUS LES DINOZS) ---
app.post('/admin/reset-dinozs', checkLeader, async (req, res) => {
    try {
        // Supprime TOUTES les entrées de la table Dinoz
        await prisma.dinoz.deleteMany({}); 
        console.log("⚠️ TOUS LES DINOZS ONT ÉTÉ SUPPRIMÉS PAR L'ADMIN.");
        
        res.redirect('/admin');
    } catch (error) {
        console.error("Erreur RAZ Dinozs:", error);
        res.redirect('/admin');
    }
});

// --- ROUTE : MODIFIER LE RÔLE D'UN UTILISATEUR ---
app.post('/admin/update-role', checkLeader, async (req, res) => {
    const { userId, newRole } = req.body;

    // Sécurité : On ne touche pas à son propre grade (évite de se rétrograder par erreur)
    if (parseInt(userId) === req.session.userId) {
        return res.redirect('/admin');
    }

    try {
        await prisma.user.update({
            where: { id: parseInt(userId) },
            data: { role: newRole }
        });
        // Pas besoin de message, on recharge juste la page
        res.redirect('/admin');
    } catch (error) {
        console.error("Erreur update role:", error);
        res.redirect('/admin');
    }
});

// 4. On allume le serveur
app.listen(PORT, () => {
    console.log(`Serveur lancé sur http://localhost:${PORT}`);
});

// --- Route: Mes Dinozs ---
app.get('/dinozs', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');

    // 1. Infos Utilisateur (Header)
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
    
    // Calcul ancienneté
    const now = new Date();
    const created = new Date(user.createdAt);
    const diffDays = Math.ceil(Math.abs(now - created) / (1000 * 60 * 60 * 24));

    // 2. Récupérer la liste des Dinozs de l'utilisateur
    const dinozs = await prisma.dinoz.findMany({
        where: { userId: user.id },
        orderBy: { level: 'desc' } // Triés par niveau (plus haut en premier)
    });

    res.render('my-dinozs', { 
        pseudo: user.pseudo, 
        role: user.role, 
        daysMember: diffDays,
        dinozs: dinozs 
    });
});


// --- Route: Créer un nouveau Dinoz ---
app.post('/dinozs/create', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');

    const { name, race, imageUrl, skinType } = req.body;

    // Gestion Image
    let finalImage = null;
    if (skinType !== 'default' && imageUrl && imageUrl.trim() !== "") {
        finalImage = imageUrl;
    }

    // --- NOUVEAU : CALCUL DES STATS DE DÉPART ---
    // 1. On nettoie le nom de la race (minuscule) pour chercher dans notre fichier
    const raceKey = race.toLowerCase(); 
    
    // 2. On récupère les stats, ou des zéros par défaut si la race est inconnue
    const baseStats = RACES_DATA[raceKey] || { 
        statFire: 0, statWood: 0, statWater: 0, statBolt: 0, statAir: 0 
    };

    try {
        await prisma.dinoz.create({
            data: {
                name: name,
                race: race, // On garde la casse d'origine (ex: "Sirain") pour l'affichage
                level: 1,
                imageUrl: finalImage,
                userId: req.session.userId,

                // --- ON INJECTE LES STATS ICI ---
                statFire: baseStats.statFire,
                statWood: baseStats.statWood,
                statWater: baseStats.statWater,
                statBolt: baseStats.statBolt, // Rappel : Bolt = Foudre
                statAir: baseStats.statAir
            }
        });
        res.redirect('/dinozs'); 
    } catch (error) {
        console.error("Erreur création dinoz:", error);
        res.redirect('/dinozs'); 
    }
});

// --- Route : Page de Détails du Dinoz ---
app.get('/dinoz/:id', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const dinozId = parseInt(req.params.id);

    try {
        const dino = await prisma.dinoz.findUnique({
            where: { id: dinozId },
            include: {
                learnedSkills: true, // Important pour vérifier PDC
                unlockedSkills: true,
                plan: true
            }
        });

        if (!dino || dino.userId !== req.session.userId) {
            return res.redirect('/dinozs');
        }

        const user = await prisma.user.findUnique({ where: { id: req.session.userId } });

        const myPlans = await prisma.skillPlan.findMany({
        where: { authorId: user.id },
        orderBy: { name: 'asc' }
        });

        // Calcul ancienneté
        const now = new Date();
        const created = new Date(user.createdAt);
        const daysMember = Math.ceil(Math.abs(now - created) / (1000 * 60 * 60 * 24));

        // --- VERIFICATION PLAN DE CARRIÈRE ---
        // On regarde si dans la liste des compétences apprises, l'une s'appelle "Plan de Carrière"
        const hasPDC = dino.learnedSkills.some(skill => skill.name === "Plan de Carrière");

        const allSkills = await prisma.refSkill.findMany({
        include: { parents: { select: { id: true } } }
        });

        res.render('dinoz-details', { 
            dino: dino, 
            user: user, // Utile si ta vue utilise 'user' directement
            pseudo: user.pseudo,
            role: user.role,
            daysMember: daysMember,
            allSkills,
            hasPDC: hasPDC,
            myPlans 
        });

    } catch (error) {
        console.error("Erreur page dinoz :", error);
        res.redirect('/dinozs');
    }
});
// --- Route : Supprimer un Dinoz ---
app.post('/dinozs/delete', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');

    const { dinozId } = req.body;

    try {
        // 1. On vérifie que le Dinoz appartient bien au joueur connecté (Sécurité !)
        const dino = await prisma.dinoz.findUnique({
            where: { id: parseInt(dinozId) }
        });

        if (dino && dino.userId === req.session.userId) {
            // 2. Suppression
            await prisma.dinoz.delete({
                where: { id: parseInt(dinozId) }
            });
            console.log(`Dinoz ${dinozId} supprimé.`);
        }
        
        // 3. Retour à la liste
        res.redirect('/dinozs');

    } catch (error) {
        console.error("Erreur suppression :", error);
        res.redirect('/dinozs');
    }
});

// --- API : Sauvegarder un choix de niveau (Grille + Calcul Niveau + Calcul Stats) ---
// --- API : Sauvegarder un choix de niveau (Grille + Calcul Niveau + Calcul Stats) ---
app.post('/dinoz/update-grid', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Non connecté" });

    const { dinoId, rowIndex, colIndex, value } = req.body;

    try {
        const dino = await prisma.dinoz.findUnique({ where: { id: parseInt(dinoId) } });
        if (!dino || dino.userId !== req.session.userId) return res.status(403).json({ error: "Interdit" });

        let gridData = dino.ups || {}; 
        if (!gridData[rowIndex]) gridData[rowIndex] = {}; 
        
        const colKey = `col${colIndex}`; 
        
        if (value === "") {
            delete gridData[rowIndex][colKey];
        } else {
            gridData[rowIndex][colKey] = value;
        }

        // --- A. CALCUL DU NIVEAU (CORRIGÉ) ---
        // Le niveau est simplement : 1 (base) + Nombre de décisions prises (col3 remplies)
        let decisionsCount = 0;

        for (const [rIdx, cols] of Object.entries(gridData)) {
            // Si la colonne 3 (décision) existe et n'est pas vide/null
            if (cols.col3 && cols.col3 !== "") {
                decisionsCount++;
            }
        }

        let newLevel = 1 + decisionsCount;

        // --- B. CALCUL DES STATS ---
        let stats = { statFire: 0, statWood: 0, statWater: 0, statBolt: 0, statAir: 0 };
        const ELEM_TO_DB = { 'Feu': 'statFire', 'Bois': 'statWood', 'Eau': 'statWater', 'Foudre': 'statBolt', 'Air': 'statAir' };

        for (const [rIdx, cols] of Object.entries(gridData)) {
            if (cols.col3) {
                try {
                    const dec = JSON.parse(cols.col3);
                    if (dec.element && ELEM_TO_DB[dec.element]) {
                        stats[ELEM_TO_DB[dec.element]]++;
                    }
                } catch (e) {}
            }
        }

        // Mise à jour DB
        await prisma.dinoz.update({
            where: { id: parseInt(dinoId) },
            data: { 
                ups: gridData,
                level: newLevel,
                ...stats 
            }
        });

        res.json({ success: true, stats: stats, level: newLevel });

    } catch (error) {
        console.error("Erreur save grid:", error);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// --- API : RÉINCARNATION ---
app.post('/dinoz/reincarnate', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Non connecté" });

    const { dinoId, bonuses } = req.body;

    try {
        // 1. Vérifions que le dino appartient bien au joueur
        const dino = await prisma.dinoz.findUnique({ where: { id: parseInt(dinoId) } });
        if (!dino || dino.userId !== req.session.userId) {
            return res.status(403).json({ error: "Interdit" });
        }

        // 2. Mise à jour massive
        await prisma.dinoz.update({
            where: { id: parseInt(dinoId) },
            data: {
                level: 1,              // Retour niveau 1
                isReincarnate: 1,      // Marqué comme réincarné
                ups: {},               // ON VIDE LA GRILLE (Important !)
                
                // On AJOUTE les bonus aux stats existantes
                statFire: { increment: bonuses.fire },
                statWood: { increment: bonuses.wood },
                statWater: { increment: bonuses.water },
                statBolt: { increment: bonuses.lightning }, // Attention: 'statBolt' dans ta DB, 'lightning' dans le JS
                statAir: { increment: bonuses.air }
            }
        });

        res.json({ success: true });

    } catch (error) {
        console.error("Erreur réincarnation:", error);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// --- API : ASSIGNER UN PLAN À UN DINOZ ---
app.post('/dinoz/assign-plan', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Non connecté" });
    const { dinoId, planId } = req.body; // planId peut être null (pour retirer)

    try {
        // Vérif propriété
        const dino = await prisma.dinoz.findUnique({ where: { id: parseInt(dinoId) } });
        if (!dino || dino.userId !== req.session.userId) return res.status(403).json({ error: "Interdit" });

        // Mise à jour
        await prisma.dinoz.update({
            where: { id: parseInt(dinoId) },
            data: {
                planId: planId ? parseInt(planId) : null // Si planId est envoyé, on met l'ID, sinon null
            }
        });

        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// --- PAGE : VISUALISEUR D'ARBRES ---
app.get('/arbres', async (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
   
    // Calcul ancienneté
    const now = new Date();
    const created = new Date(user.createdAt);
    const daysMember = Math.ceil(Math.abs(now - created) / (1000 * 60 * 60 * 24));

    const allSkills = await prisma.refSkill.findMany({
        include: {
            parents: { select: { id: true } },
            children: { select: { id: true } }
        }
    });

    res.render('arbres', { 
        user, 
        pseudo: user.pseudo,
        role: user.role,
        daysMember: daysMember,
        skills: allSkills,
        userTreeMode: user.treeMode || "COMPRESSED"
    });
});


// --- API : SAUVEGARDER PRÉFÉRENCES ---
app.post('/api/preference', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Non connecté' });
    
    const { key, value } = req.body;
    
    // Sécurité simple : on n'autorise que la modif de treeMode pour l'instant
    if (key === 'treeMode') {
        await prisma.user.update({
            where: { id: req.session.userId },
            data: { treeMode: value }
        });
        return res.json({ success: true });
    }
    
    res.status(400).json({ error: 'Champ invalide' });
});

// --- CONFIGURATION DES MAPPINGS ---
// Pour traduire l'anglais (du front) vers le Français (de la BDD RefSkill)
const ELEM_MAP_DB = {
    'fire': 'Feu', 'wood': 'Bois', 'water': 'Eau', 
    'lightning': 'Foudre', 'air': 'Air', 'void': 'Vide'
};

// Pour savoir quelle colonne incrémenter dans la table Dinoz
const SPHERE_COL_MAP = {
    'fire': 'sphereFire', 'wood': 'sphereWood', 'water': 'sphereWater', 
    'lightning': 'sphereBolt', 'air': 'sphereAir', 'void': 'sphereVoid'
};

// --- ROUTE : AJOUTER UNE SPHÈRE ---
app.post('/dinoz/add-sphere', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Non connecté" });

    const { dinoId, element } = req.body; // element = 'fire', 'wood', etc.

    try {
        // 1. On récupère le Dinoz
        const dino = await prisma.dinoz.findUnique({ 
            where: { id: parseInt(dinoId) },
            include: { learnedSkills: true }
        });

        if (!dino || dino.userId !== req.session.userId) return res.status(403).json({ error: "Interdit" });

        // 2. Vérification du compteur actuel
        const sphereField = SPHERE_COL_MAP[element];
        const currentCount = dino[sphereField]; // ex: 0, 1 ou 2

        if (currentCount >= 3) {
            return res.status(400).json({ error: "Maximum de 3 sphères atteint pour cet élément." });
        }

        // 3. On cherche la compétence correspondante en BDD
        // On veut : Bonne Nature (3), Bon Élément, Trié par ID croissant
        const dbElement = ELEM_MAP_DB[element];
        
        const sphereSkills = await prisma.refSkill.findMany({
            where: { 
                element: dbElement,
                skillNature: 3
            },
            orderBy: { id: 'asc' } // On suppose que ID petit = Niveau 1, ID grand = Niveau 3
        });

        // On prend la compétence à l'index correspondant au compteur actuel
        // ex: Si j'ai 0 sphère, je prends l'index 0 (la 1ère compétence)
        const skillToLearn = sphereSkills[currentCount];

        if (!skillToLearn) {
            return res.status(404).json({ error: `Pas de compétence sphérique de niveau ${currentCount + 1} trouvée pour ${dbElement}.` });
        }

        // 4. On met à jour le Dinoz
        await prisma.dinoz.update({
            where: { id: parseInt(dinoId) },
            data: {
                [sphereField]: currentCount + 1, // On augmente le compteur
                learnedSkills: {
                    connect: { id: skillToLearn.id } // On ajoute la compétence aux apprises
                }
            }
        });

        res.json({ success: true, skillName: skillToLearn.name });

    } catch (error) {
        console.error("Erreur ajout sphère:", error);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// --- PAGE : ARCHITECTE (CRÉATION OU ÉDITION) ---
app.get('/architecte', async (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } });

    // Calcul ancienneté
    const now = new Date();
    const created = new Date(user.createdAt);
    const daysMember = Math.ceil(Math.abs(now - created) / (1000 * 60 * 60 * 24));

    // 1. Compétences
    const allSkills = await prisma.refSkill.findMany({
        include: {
            parents: { select: { id: true } },
            children: { select: { id: true } }
        },
        orderBy: { id: 'asc' }
    });

    // 2. Races
    const raceList = [
        'castivore', 'gorilloz', 'hippoclamp', 'moueffe', 'nuagoz', 
        'pigmou', 'planaille', 'pteroz', 'rocky', 'sirain', 
        'wanwan', 'winks', 'feross', 'kabuki', 'mahamuti', 
        'quetzu', 'santaz', 'smog', 'soufflet', 'toufufu', 'triceragnon'
    ].sort();

    // 3. GESTION DE L'ÉDITION (Nouveau bloc)
    let planToEdit = null;
    if (req.query.id) {
        // On cherche le plan demandé
        const existingPlan = await prisma.skillPlan.findUnique({ 
            where: { id: parseInt(req.query.id) } 
        });
        
        // Sécurité : On ne peut éditer que SES propres plans
        if (existingPlan && existingPlan.authorId === user.id) {
            planToEdit = existingPlan;
        }
    }

    res.render('architecte', { 
        user, 
        pseudo: user.pseudo,
        role: user.role,
        skills: allSkills,
        daysMember,
        raceList,
        plan: planToEdit // On envoie le plan (ou null si c'est une création)
    });
});

// --- API : SAUVEGARDER UN PLAN (Architecte) ---
app.post('/architecte/save', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Non connecté' });

    const { id, name, race, isPublic, selectedSkillIds, level } = req.body;

    try {
        if (id) {
            // --- MODIFICATION ---
            const existing = await prisma.skillPlan.findUnique({ where: { id: parseInt(id) } });
            if (!existing || existing.authorId !== req.session.userId) {
                return res.status(403).json({ error: "Ce plan ne vous appartient pas." });
            }

            await prisma.skillPlan.update({
                where: { id: parseInt(id) },
                data: {
                    name: name.trim(),
                    race: race,
                    isPublic: isPublic === true || isPublic === 'true',
                    skillIds: selectedSkillIds,
                    level: parseInt(level) || 1,
                    
                    // C'EST ICI LA MAGIE :
                    // Si je modifie le plan, je deviens le seul créateur (on vide l'originalAuthor)
                    originalAuthor: null 
                }
            });
        } else {
            // --- CRÉATION ---
            await prisma.skillPlan.create({
                data: {
                    name: name.trim() || 'Plan sans nom',
                    race: race,
                    isPublic: isPublic === true || isPublic === 'true',
                    skillIds: selectedSkillIds,
                    level: parseInt(level) || 1,
                    authorId: req.session.userId,
                    originalAuthor: null // Pas d'auteur original, c'est moi
                }
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.error("Erreur sauvegarde plan:", error);
        res.status(500).json({ error: "Erreur lors de la sauvegarde." });
    }
});

// --- PAGE : MES PLANS ---
app.get('/plans', async (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } });

    const myPlans = await prisma.skillPlan.findMany({
        where: { authorId: user.id },
        orderBy: { createdAt: 'desc' },
        include: { author: { select: { pseudo: true } } } // Pour afficher l'auteur
    });

    // Calcul ancienneté (Header)
    const daysMember = Math.ceil(Math.abs(new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24));

    res.render('plans', { user, pseudo: user.pseudo, role: user.role, daysMember, plans: myPlans });
});

// --- PAGE : PLANS DU CLAN ---
app.get('/clan/plans', async (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } });

    const clanPlans = await prisma.skillPlan.findMany({
        where: { isPublic: true }, // Tous les plans publics
        orderBy: { createdAt: 'desc' },
        include: { author: { select: { pseudo: true } } }
    });

    const daysMember = Math.ceil(Math.abs(new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24));

    res.render('clan-plans', { user, pseudo: user.pseudo, role: user.role, daysMember, plans: clanPlans });
});

// --- PAGE : DÉTAILS D'UN PLAN (VISUALISEUR) ---
app.get('/plan/:id', async (req, res) => {
    if (!req.session.userId) return res.redirect('/');
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
    
    const planId = parseInt(req.params.id);
    const plan = await prisma.skillPlan.findUnique({ 
        where: { id: planId },
        include: { author: { select: { pseudo: true, id: true } } }
    });

    if (!plan) return res.redirect('/plans');

    // On a besoin des compétences pour afficher l'arbre (comme architecte)
    const allSkills = await prisma.refSkill.findMany({
        include: { parents: { select: { id: true } }, children: { select: { id: true } } },
        orderBy: { id: 'asc' }
    });

    const daysMember = Math.ceil(Math.abs(new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24));

    res.render('plan-details', { 
        user, pseudo: user.pseudo, role: user.role, daysMember, 
        plan, skills: allSkills 
    });
});

// --- API : SUPPRIMER UN PLAN ---
app.post('/plan/delete', async (req, res) => {
    if (!req.session.userId) return res.status(403).json({ error: "Non connecté" });
    const { planId } = req.body;

    try {
        const plan = await prisma.skillPlan.findUnique({ where: { id: parseInt(planId) } });
        // Seul l'auteur ou un LEADER peut supprimer
        const user = await prisma.user.findUnique({ where: { id: req.session.userId } });

        if (plan.authorId !== user.id && user.role !== 'LEADER') {
            return res.status(403).json({ error: "Interdit" });
        }

        await prisma.skillPlan.delete({ where: { id: parseInt(planId) } });
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// --- API : CLONER (AJOUTER À MES PLANS) ---
app.post('/plan/clone', async (req, res) => {
    if (!req.session.userId) return res.status(403).json({ error: "Non connecté" });
    const { planId } = req.body;

    try {
        // On inclut l'auteur pour récupérer son pseudo
        const original = await prisma.skillPlan.findUnique({ 
            where: { id: parseInt(planId) },
            include: { author: true } 
        });
        
        if (!original) return res.status(404).json({ error: "Plan introuvable" });

        // Si le plan copié avait déjà un auteur original, on le garde. Sinon on prend l'auteur actuel.
        const creditName = original.originalAuthor || original.author.pseudo;

        // On crée une copie
        await prisma.skillPlan.create({
            data: {
                name: original.name, // On garde le même nom (sans "Copie", plus propre)
                race: original.race,
                skillIds: original.skillIds,
                level: original.level,
                isPublic: false, // Privé par défaut dans ma bibliothèque
                
                authorId: req.session.userId, // C'est techniquement dans MA liste
                originalAuthor: creditName    // Mais on se souvient que c'est de lui !
            }
        });
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Erreur serveur" });
    }
});