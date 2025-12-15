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