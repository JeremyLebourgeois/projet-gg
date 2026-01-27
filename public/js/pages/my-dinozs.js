document.addEventListener('DOMContentLoaded', () => {
    // Éléments du DOM
    const searchInput = document.querySelector('.search-input');
    const dinoCards = document.querySelectorAll('#user-dino-grid .dino-card');
    const searchEmpty = document.querySelector('.search-empty');
    const btnRace = document.querySelector('.btn-race');
    
    const userGrid = document.getElementById('user-dino-grid');
    const raceGrid = document.getElementById('race-selector-grid');

    // 1. CONFIGURATION DES RACES
    const racesList = [
        "Castivore", "Gorilloz", "Hippoclamp", "Moueffe", "Nuagoz", "Pigmou", "Planaille",
        "Pteroz", "Rocky", "Sirain", "Wanwan", "Winks", "Feross", "Kabuki", "Mahamuti",
        "Quetzu", "Santaz", "Smog", "Soufflet", "Toufufu", "Triceragnon"
    ];

    // Génération dynamique de la grille des races
    racesList.forEach(race => {
        const raceCard = document.createElement('div');
        raceCard.className = 'dino-card race-card';
        
        raceCard.innerHTML = `
            <div class="card-img-container" style="height: 100%;">
                <img src="/img/races/${race.toLowerCase()}.png" alt="${race}" title="${race}" style="max-height: 100%;">
            </div>
        `;

        raceCard.addEventListener('click', () => filterByRace(race));
        raceGrid.appendChild(raceCard);
    });

    // 2. LOGIQUE DU BOUTON "RACES"
    btnRace.addEventListener('click', () => {
        if (raceGrid.classList.contains('hidden')) {
            userGrid.classList.add('hidden');
            raceGrid.classList.remove('hidden');
            btnRace.innerHTML = 'Retour <i class="fas fa-undo"></i>';
        } else {
            resetView();
        }
    });

    function resetView() {
        userGrid.classList.remove('hidden');
        raceGrid.classList.add('hidden');
        btnRace.innerHTML = 'Races';
        
        dinoCards.forEach(card => card.style.display = '');
        searchEmpty.style.display = 'none';
        searchInput.value = '';
    }

    // 3. FILTRAGE PAR RACE
    function filterByRace(selectedRace) {
        userGrid.classList.remove('hidden');
        raceGrid.classList.add('hidden');
        btnRace.innerHTML = 'Races';

        let visibleCount = 0;
        dinoCards.forEach(card => {
            const cardText = card.querySelector('.card-info p').textContent;
            if (cardText.includes(selectedRace)) {
                card.style.display = '';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });

        if (visibleCount === 0) {
            searchEmpty.style.display = 'block';
            searchEmpty.textContent = `Aucun ${selectedRace} trouvé parmis tes p'tits guerriers givrés.`;
        } else {
            searchEmpty.style.display = 'none';
        }
    }

    // 4. RECHERCHE
    function filterSearch() {
        const filterValue = searchInput.value.toLowerCase().trim();
        let visibleCount = 0;

        if (userGrid.classList.contains('hidden')) {
            userGrid.classList.remove('hidden');
            raceGrid.classList.add('hidden');
            btnRace.innerHTML = 'Races';
        }

        dinoCards.forEach(card => {
            const dinoName = card.querySelector('h3').textContent.toLowerCase();
            if (dinoName.includes(filterValue)) {
                card.style.display = '';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });

        if (visibleCount === 0) {
            searchEmpty.style.display = 'block';
            searchEmpty.textContent = "Aucun résultat pour cette recherche.";
        } else {
            searchEmpty.style.display = 'none';
        }
    }

    searchInput.addEventListener('input', filterSearch);

    // 5. GESTION DE LA MODALE
    const modal = document.getElementById('new-dino-modal');
    const btnNew = document.querySelector('.btn-new');
    const btnClose = document.getElementById('close-modal');
    const urlInput = document.getElementById('url-input');

    btnNew.addEventListener('click', () => modal.classList.remove('hidden'));
    btnClose.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });

    // Fonction globale pour l'attribut onchange du HTML
    window.toggleUrlInput = function(show) {
        if (show) {
            urlInput.classList.remove('hidden');
            urlInput.required = true;
        } else {
            urlInput.classList.add('hidden');
            urlInput.required = false;
            urlInput.value = '';
        }
    };
});

// Rechargement si retour arrière (cache navigateur)
window.addEventListener('pageshow', function(event) {
    if (event.persisted || performance.getEntriesByType("navigation")[0].type === 'back_forward') {
        window.location.reload();
    }
});