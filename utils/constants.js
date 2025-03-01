const {getDynamicStatYear} = require('./helperFunctions/dataHelpers/dataSanitizers')
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
        learningDecayFactor: .96
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
        learningDecayFactor: .96
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
        learningDecayFactor: .96
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
        learningDecayFactor: .96
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
        learningDecayFactor: .96
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
        learningDecayFactor: .96
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
        learningDecayFactor: .96
    },
]

const learningRate = .001 //Controls how much the weights are adjusted during training .00001 to .01
const batchSize = 64 //The number of samples processed before the model is updated 16, 32, 64, 128
const epochsValue = 100 //The number of times the model is trained on the entire dataset. 10, 50, 100, 200
const weightDecayl2 = 0.0001 //Adds a penalty to the loss for large weights, helping to prevent overfitting .00001 to 0
const dropoutRate = .5 //Randomly drops neurons during training to prevent overfitting by preventing co-adaptation of hidden units. .2 to .5
const layerNeurons = 128 //More neurons increase the model's capacity to learn but can lead to overfitting. 16 - 1000



module.exports = {sports, learningRate, batchSize, epochsValue, weightDecayl2, dropoutRate, layerNeurons}