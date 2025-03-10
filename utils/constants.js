const {getDynamicStatYear} = require('./helperFunctions/dataHelpers/dataSanitizers')
const nflHyperParams = require('../hyperParameterTesting/americanfootball_nflbestSettings.json')
const ncaafHyperParams = require('../hyperParameterTesting/americanfootball_ncaafbestSettings.json')
const nbaHyperParams = require('../hyperParameterTesting/basketball_nbabestSettings.json')
const nhlHyperParams = require('../hyperParameterTesting/icehockey_nhlbestSettings.json')
const ncaabHyperParams = require('../hyperParameterTesting/basketball_ncaabbestSettings.json')
const wncaabHyperParams = require('../hyperParameterTesting/basketball_wncaabbestSettings.json')
const mlbHyperParams = require('../hyperParameterTesting/baseball_mlbbestSettings.json')
const sports = [
    {
        name: "americanfootball_nfl",
        espnSport: 'football',
        league: 'nfl',
        startMonth: 9,
        endMonth: 2,
        multiYear: true,
        statYear: getDynamicStatYear(9, 2, new Date()), // NFL starts in 2024 but extends into 2025, so statYear = 2024
        prevstatYear: getDynamicStatYear(9, 2, new Date()), // NHL also uses the same logic for prevstatYear
        decayFactor: 1,
        gameDecayThreshold: 160,
        learningDecayFactor: .96,
        epochs: nflHyperParams.epochs,
        batchSize: nflHyperParams.batchSize,
        KFolds: nflHyperParams.KFolds,
        hiddenLayerNum: nflHyperParams.hiddenLayerNum,
        learningRate: nflHyperParams.learningRate,
        l2Reg: nflHyperParams.l2Reg,
        dropoutReg: nflHyperParams.dropoutReg,
        kernalInitializer: nflHyperParams.kernalInitializer
    },
    {
        name: "americanfootball_ncaaf",
        espnSport: 'football',
        league: 'college-football',
        startMonth: 9,
        endMonth: 1,
        multiYear: true,
        statYear: getDynamicStatYear(9, 1, new Date()), // NCAA Football starts in 2024 but ends in 2025, so statYear = 2024
        prevstatYear: getDynamicStatYear(9, 1, new Date()), // NHL also uses the same logic for prevstatYear
        decayFactor: 1,
        gameDecayThreshold: 360,
        learningDecayFactor: .96,
        epochs: ncaafHyperParams.epochs,
        batchSize: ncaafHyperParams.batchSize,
        KFolds: ncaafHyperParams.KFolds,
        hiddenLayerNum: ncaafHyperParams.hiddenLayerNum,
        learningRate: ncaafHyperParams.learningRate,
        l2Reg: ncaafHyperParams.l2Reg,
        dropoutReg: ncaafHyperParams.dropoutReg,
        kernalInitializer: ncaafHyperParams.kernalInitializer
    },
    {
        name: "basketball_nba",
        espnSport: 'basketball',
        league: 'nba',
        startMonth: 10,
        endMonth: 4,
        multiYear: true,
        statYear: getDynamicStatYear(10, 4, new Date()), // NBA starts in 2024 but extends into 2025, so statYear = 2025
        prevstatYear: getDynamicStatYear(10, 4, new Date()), // NHL also uses the same logic for prevstatYear
        decayFactor: 1,
        gameDecayThreshold: 160,
        learningDecayFactor: .96,
        epochs: nbaHyperParams.epochs,
        batchSize: nbaHyperParams.batchSize,
        KFolds: nbaHyperParams.KFolds,
        hiddenLayerNum: nbaHyperParams.hiddenLayerNum,
        learningRate: nbaHyperParams.learningRate,
        l2Reg: nbaHyperParams.l2Reg,
        dropoutReg: nbaHyperParams.dropoutReg,
        kernalInitializer: nbaHyperParams.kernalInitializer
    },
    {
        name: "icehockey_nhl",
        espnSport: 'hockey',
        league: 'nhl',
        startMonth: 10,
        endMonth: 4,
        multiYear: true,
        statYear: getDynamicStatYear(10, 4, new Date()), // NHL starts in 2024 but extends into 2025, so statYear = 2025
        prevstatYear: getDynamicStatYear(10, 4, new Date()), // NHL also uses the same logic for prevstatYear
        decayFactor: 1,
        gameDecayThreshold: 160,
        learningDecayFactor: .96,
        epochs: nhlHyperParams.epochs,
        batchSize: nhlHyperParams.batchSize,
        KFolds: nhlHyperParams.KFolds,
        hiddenLayerNum: nhlHyperParams.hiddenLayerNum,
        learningRate: nhlHyperParams.learningRate,
        l2Reg: nhlHyperParams.l2Reg,
        dropoutReg: nhlHyperParams.dropoutReg,
        kernalInitializer: nhlHyperParams.kernalInitializer
    },
    {
        name: "baseball_mlb",
        espnSport: 'baseball',
        league: 'mlb',
        startMonth: 2,
        endMonth: 10,
        multiYear: false,
        statYear: getDynamicStatYear(2, 10, new Date()), // MLB starts in 2024 but ends in 2024, so statYear = 2024
        prevstatYear: getDynamicStatYear(2, 10, new Date()), // NHL also uses the same logic for prevstatYear
        decayFactor: 1,
        gameDecayThreshold: 150,
        learningDecayFactor: .96,
        epochs: mlbHyperParams.epochs,
        batchSize: mlbHyperParams.batchSize,
        KFolds: mlbHyperParams.KFolds,
        hiddenLayerNum: mlbHyperParams.hiddenLayerNum,
        learningRate: mlbHyperParams.learningRate,
        l2Reg: mlbHyperParams.l2Reg,
        dropoutReg: mlbHyperParams.dropoutReg,
        kernalInitializer: mlbHyperParams.kernalInitializer
    },
    {
        name: "basketball_ncaab",
        espnSport: 'basketball',
        league: 'mens-college-basketball',
        startMonth: 11,
        endMonth: 4,
        multiYear: true,
        statYear: getDynamicStatYear(11, 4, new Date()), // NCAA Basketball starts in 2024 but ends in 2025, so statYear = 2025
        prevstatYear: getDynamicStatYear(11, 4, new Date()), // NHL also uses the same logic for prevstatYear
        decayFactor: 1,
        gameDecayThreshold: 350,
        learningDecayFactor: .96,
        epochs: ncaabHyperParams.epochs,
        batchSize: ncaabHyperParams.batchSize,
        KFolds: ncaabHyperParams.KFolds,
        hiddenLayerNum: ncaabHyperParams.hiddenLayerNum,
        learningRate: ncaabHyperParams.learningRate,
        l2Reg: ncaabHyperParams.l2Reg,
        dropoutReg: ncaabHyperParams.dropoutReg,
        kernalInitializer: ncaabHyperParams.kernalInitializer
    },
    {
        name: "basketball_wncaab",
        espnSport: 'basketball',
        league: 'womens-college-basketball',
        startMonth: 11,
        endMonth: 4,
        multiYear: true,
        statYear: getDynamicStatYear(11, 4, new Date()), // Same as men's college basketball
        prevstatYear: getDynamicStatYear(11, 4, new Date()), // NHL also uses the same logic for prevstatYear
        decayFactor: 1,
        gameDecayThreshold: 350,
        learningDecayFactor: .96,
        epochs: wncaabHyperParams.epochs,
        batchSize: wncaabHyperParams.batchSize,
        KFolds: wncaabHyperParams.KFolds,
        hiddenLayerNum: wncaabHyperParams.hiddenLayerNum,
        learningRate: wncaabHyperParams.learningRate,
        l2Reg: wncaabHyperParams.l2Reg,
        dropoutReg: wncaabHyperParams.dropoutReg,
        kernalInitializer: wncaabHyperParams.kernalInitializer
    },
]

const learningRate = .001 //Controls how much the weights are adjusted during training .00001 to .01
const batchSize = 64 //The number of samples processed before the model is updated 16, 32, 64, 128
const epochsValue = 100 //The number of times the model is trained on the entire dataset. 10, 50, 100, 200
const weightDecayl2 = 0.0001 //Adds a penalty to the loss for large weights, helping to prevent overfitting .00001 to 0
const dropoutRate = .5 //Randomly drops neurons during training to prevent overfitting by preventing co-adaptation of hidden units. .2 to .5
const layerNeurons = 128 //More neurons increase the model's capacity to learn but can lead to overfitting. 16 - 1000



module.exports = {sports, learningRate, batchSize, epochsValue, weightDecayl2, dropoutRate, layerNeurons}