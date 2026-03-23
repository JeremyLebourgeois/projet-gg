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

    let congealState = 0; // 0 = default (hide frozen), 1 = all, 2 = frozen only
    let currentRaceFilter = null;
    const btnCongealed = document.querySelector('.btn-congealed');

    // Initial state style
    btnCongealed.style.opacity = '0.5';
    btnCongealed.style.borderColor = '#555';
    btnCongealed.title = "Cacher les Dinozs congelés";

    btnCongealed.addEventListener('click', () => {
        congealState = (congealState + 1) % 3;
        
        if (congealState === 0) {
            btnCongealed.style.opacity = '0.5';
            btnCongealed.style.background = '';
            btnCongealed.style.borderColor = '#555';
            btnCongealed.title = "Cacher les Dinozs congelés";
        } else if (congealState === 1) {
            btnCongealed.style.opacity = '1';
            btnCongealed.style.background = '';
            btnCongealed.style.borderColor = '#4fc3f7';
            btnCongealed.title = "Afficher tous les Dinozs";
        } else if (congealState === 2) {
            btnCongealed.style.opacity = '1';
            btnCongealed.style.background = 'linear-gradient(180deg, #29b6f6, #0277bd)';
            btnCongealed.style.borderColor = '#00e5ff';
            btnCongealed.title = "Dinozs congelés uniquement";
        }
        
        if (!raceGrid.classList.contains('hidden')) {
            userGrid.classList.remove('hidden');
            raceGrid.classList.add('hidden');
            btnRace.innerHTML = 'Races';
        }

        applyFilters();
    });

    function applyFilters() {
        const filterValue = searchInput.value.toLowerCase().trim();
        let visibleCount = 0;

        dinoCards.forEach(card => {
            const isCongealed = card.getAttribute('data-congealed') === '1';
            const cardRace = card.querySelector('.card-info p').textContent.toLowerCase();
            const dinoName = card.querySelector('h3').textContent.toLowerCase();
            
            let showFrozen = false;
            if (congealState === 0 && !isCongealed) showFrozen = true;
            if (congealState === 1) showFrozen = true;
            if (congealState === 2 && isCongealed) showFrozen = true;

            let showSearch = filterValue === '' || dinoName.includes(filterValue);
            let showRace = currentRaceFilter === null || cardRace.includes(currentRaceFilter.toLowerCase());

            if (showFrozen && showSearch && showRace) {
                card.style.display = '';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });

        if (visibleCount === 0) {
            searchEmpty.style.display = 'block';
            if (currentRaceFilter) {
                searchEmpty.textContent = `Aucun ${currentRaceFilter.charAt(0).toUpperCase() + currentRaceFilter.slice(1)} avec ces filtres.`;
            } else {
                searchEmpty.textContent = "Aucun résultat pour cette recherche ou ces filtres.";
            }
        } else {
            searchEmpty.style.display = 'none';
        }
    }

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
        searchInput.value = '';
        currentRaceFilter = null;
        applyFilters();
    }

    // 3. FILTRAGE PAR RACE
    function filterByRace(selectedRace) {
        userGrid.classList.remove('hidden');
        raceGrid.classList.add('hidden');
        btnRace.innerHTML = 'Races';
        currentRaceFilter = selectedRace;
        searchInput.value = ''; 
        applyFilters();
    }

    // 4. RECHERCHE
    searchInput.addEventListener('input', () => {
        if (!raceGrid.classList.contains('hidden')) {
            userGrid.classList.remove('hidden');
            raceGrid.classList.add('hidden');
            btnRace.innerHTML = 'Races';
        }
        currentRaceFilter = null; 
        applyFilters();
    });

    // Appliquer l'état par défaut (cacher les congelés)
    applyFilters();

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