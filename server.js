// 1. On importe les outils
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const session = require('express-session'); 
const bcrypt = require('bcrypt');

// 2. On configure le serveur
const app = express();
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

    // Logique de l'image :
    // Si l'utilisateur a coché "Skin de Glace" (skinType === 'default'), on met null dans la DB.
    // (Car ton code EJS gère déjà : si null -> affiche l'image /img/race.png)
    // Sinon, on prend l'URL fournie.
    let finalImage = null;
    if (skinType !== 'default' && imageUrl && imageUrl.trim() !== "") {
        finalImage = imageUrl;
    }

    try {
        await prisma.dinoz.create({
            data: {
                name: name,
                race: race,
                level: 1, // On commence niveau 1
                imageUrl: finalImage,
                userId: req.session.userId,
                // Initialiser les stats ici selon la race
               
            }
        });
        res.redirect('/dinozs'); // On recharge la page pour voir le nouveau bébé
    } catch (error) {
        console.error("Erreur création dinoz:", error);
        res.redirect('/dinozs'); // En cas d'erreur on redirige quand même pour l'instant
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
                unlockedSkills: true
            }
        });

        if (!dino || dino.userId !== req.session.userId) {
            return res.redirect('/dinozs');
        }

        const user = await prisma.user.findUnique({ where: { id: req.session.userId } });

        // Calcul de l'ancienneté
        const now = new Date();
        const diffTime = Math.abs(now - user.createdAt);
        const daysMember = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // --- VERIFICATION PLAN DE CARRIÈRE ---
        // On regarde si dans la liste des compétences apprises, l'une s'appelle "Plan de Carrière"
        const hasPDC = dino.learnedSkills.some(skill => skill.name === "Plan de Carrière");

        res.render('dinoz-details', { 
            dino: dino, 
            user: user, // Utile si ta vue utilise 'user' directement
            pseudo: user.pseudo,
            role: user.role,
            daysMember: daysMember,
            hasPDC: hasPDC // <--- On envoie l'info à la page (true ou false)
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