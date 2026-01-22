const racesData = {
    'moueffe': { statFire: 2, statWood: 0, statWater: 0, statBolt: 0, statAir: 0 },
    'moueffe_demon': { statFire: 2, statWood: 0, statWater: 0, statBolt: 0, statAir: 0 },
    
    'pigmou': { statFire: 2, statWood: 0, statWater: 0, statBolt: 0, statAir: 0 },
    'pigmou_demon': { statFire: 2, statWood: 0, statWater: 0, statBolt: 0, statAir: 0 },
    
    'winks': { statFire: 0, statWood: 0, statWater: 1, statBolt: 1, statAir: 0 },
    'winks_demon': { statFire: 0, statWood: 0, statWater: 1, statBolt: 1, statAir: 0 },
    
    'planaille': { statFire: 0, statWood: 0, statWater: 0, statBolt: 2, statAir: 0 },
    'planaille_demon': { statFire: 0, statWood: 0, statWater: 0, statBolt: 2, statAir: 0 }, // MTS dit 5 foudre pour démon, vérifie si tu veux 2 ou 5 (souvent 2 au lvl 1 + skills)
    
    'castivore': { statFire: 0, statWood: 1, statWater: 0, statBolt: 0, statAir: 1 },
    
    'rocky': { statFire: 0, statWood: 0, statWater: 0, statBolt: 1, statAir: 0 },
    
    'pteroz': { statFire: 0, statWood: 0, statWater: 0, statBolt: 0, statAir: 3 },
    
    'nuagoz': { statFire: 0, statWood: 0, statWater: 0, statBolt: 1, statAir: 1 },
    
    'sirain': { statFire: 0, statWood: 0, statWater: 2, statBolt: 0, statAir: 0 },
    
    'hippoclamp': { statFire: 1, statWood: 1, statWater: 1, statBolt: 1, statAir: 1 },
    
    'gorilloz': { statFire: 0, statWood: 2, statWater: 0, statBolt: 0, statAir: 0 },
    'gorilloz_demon': { statFire: 0, statWood: 2, statWater: 0, statBolt: 0, statAir: 0 },
    
    'wanwan': { statFire: 0, statWood: 1, statWater: 0, statBolt: 1, statAir: 0 },
    'wanwan_demon': { statFire: 0, statWood: 1, statWater: 0, statBolt: 1, statAir: 0 },
    
    'santaz': { statFire: 1, statWood: 0, statWater: 1, statBolt: 0, statAir: 2 },
    
    'feross': { statFire: 1, statWood: 1, statWater: 1, statBolt: 0, statAir: 0 },
    
    'kabuki': { statFire: 0, statWood: 0, statWater: 1, statBolt: 0, statAir: 3 }, // MTS dit Air 3 ? Souvent Kabuki c'est Eau/Air
    'kabuki_demon': { statFire: 0, statWood: 0, statWater: 1, statBolt: 0, statAir: 3 },
    
    'mahamuti': { statFire: 0, statWood: 2, statWater: 2, statBolt: 0, statAir: 0 }, // J'ai corrigé selon le MTS (Wood 2) mais vérifie si c'est pas Wood 0
    
    'soufflet': { statFire: 0, statWood: 1, statWater: 1, statBolt: 1, statAir: 2 },
    
    'toufufu': { statFire: 0, statWood: 2, statWater: 0, statBolt: 2, statAir: 0 },
    
    'quetzu': { statFire: 2, statWood: 0, statWater: 2, statBolt: 0, statAir: 0 },
    
    'smog': { statFire: 1, statWood: 0, statWater: 0, statBolt: 2, statAir: 2 },
    
    'triceragnon': { statFire: 2, statWood: 2, statWater: 0, statBolt: 1, statAir: 1 }
};

module.exports = racesData;