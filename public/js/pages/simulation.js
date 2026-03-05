function convertPlanToGhostDinoz(plan, raceData, allSkills) {
    // 1. Récupérer les compétences du plan
    const learnedSkills = allSkills.filter(skill => plan.skillIds.includes(skill.id));

    // 2. Calculer les éléments exacts (Base de la race + 1 par compétence de l'élément)
    let elements = {
        fire: raceData.baseFire + learnedSkills.filter(s => s.element === 'Fire').length,
        wood: raceData.baseWood + learnedSkills.filter(s => s.element === 'Wood').length,
        water: raceData.baseWater + learnedSkills.filter(s => s.element === 'Water').length,
        bolt: raceData.baseBolt + learnedSkills.filter(s => s.element === 'Bolt').length,
        air: raceData.baseAir + learnedSkills.filter(s => s.element === 'Air').length
    };

    // 3. Retourner l'objet formaté pour le simulateur
    return {
        id: `ghost_${plan.id}`,
        name: `[Fantôme] ${plan.name}`,
        race: plan.race,
        level: plan.level,
        isGhost: true,
        elements: elements,
        learnedSkills: learnedSkills
    };
}