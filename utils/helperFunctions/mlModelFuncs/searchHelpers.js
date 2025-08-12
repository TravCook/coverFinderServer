const moment = require('moment')
const { Odds, PastGameOdds, Sport } = require('../../../models');
const db = require('../../../models_sql');
const Sequelize = require('sequelize');
const { Op } = Sequelize;
const { trainSportModelKFold } = require('../../helperFunctions/mlModelFuncs/trainingHelpers')
const cliProgress = require('cli-progress');
const fs = require('fs');
const { BayesianOptimizer } = require("bayesian-optimizer");

function roundToNearest(value, options) {
    return options.reduce((prev, curr) =>
        Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
    );
}

const score = (ci, sampleSize) => {
    const minSampleSize = 30;
    if (sampleSize < minSampleSize) return -Infinity;

    const ciMidpoint = (ci.lower + ci.upper) / 2;
    const ciWidthPenalty = (ci.upper - ci.lower); // narrower = better
    const sizeBonus = Math.log(sampleSize); // diminishing returns to size

    return ciMidpoint - ciWidthPenalty + sizeBonus * 0.001; // tune 0.01 as weight
};


const hyperparameterRandSearch = async (sports) => {
    console.log(`STARTING HYPERPARAM SEARCH @ ${moment().format('HH:mm:ss')}`)


    const space = {
        learningRate: { min: 0.0001, max: 0.01 },
        batchSize: { min: 16, max: 128 },
        epochs: { min: 10, max: 100 },
        hiddenLayerNum: { min: 1, max: 5 },
        layerNeurons: { min: 16, max: 256 },
        l2reg: { min: 0, max: 0.01 },
        dropoutReg: {min: 0, max: .01},
        kFolds: { min: 4, max: 10 },
        historyLength: { min: 5, max: 60 },
        gameDecayValue: { min: .90, max: .99 },
        decayStepSize: { min: 1, max: 150 },
        // scoreLossWeight: { min: 0.1, max: 1.0 },
        // winPCTLossWeight: { min: 0.1, max: 1.0 },
    };
    for (let sport of sports.sort((a, b) => a.startMonth - b.startMonth)) {
        if (sport.name !== 'baseball_mlb') continue
        console.log(`--------------- ${sport.name} @ ${moment().format('HH:mm:ss')}-------------------`)
        const validBatchSizes = [32, 64, 128];
        const validLayerNeurons = [16, 32, 64, 128, 256];
        async function objective(params) {
            const sanitizedParams = {
                learningRate: params.learningRate,
                l2reg: params.l2reg,
                dropoutReg: params.dropoutReg,
                batchSize: roundToNearest(params.batchSize, validBatchSizes),
                epochs: Math.round(params.epochs),
                hiddenLayerNum: Math.round(params.hiddenLayerNum),
                layerNeurons: roundToNearest(params.layerNeurons, validLayerNeurons),
                kFolds: Math.round(params.kFolds),
                historyLength: Math.round(params.historyLength),
                gameDecayValue: params.gameDecayValue,
                decayStepSize: Math.round(params.decayStepSize)
            };
            const testSport = {
                ...sport,  // ensure sport is in outer scope
                hyperParameters: sanitizedParams
            };
            let upcomingGames = await db.Games.findAll({
                where: {
                    sport_key: sport.name,
                    complete: false
                }
            })
            const pastGames = await db.Games.findAll({
                where: { complete: true, sport_key: sport.name },
                include: [
                    { model: db.Teams, as: 'homeTeamDetails' },
                    { model: db.Teams, as: 'awayTeamDetails' },
                    { model: db.Sports, as: 'sportDetails' },
                    {
                        model: db.Stats, as: `homeStats`, required: true,
                        where: {
                            [Op.and]: [
                                { teamId: { [Op.eq]: Sequelize.col('Games.homeTeam') } },
                                { gameId: { [Op.eq]: Sequelize.col('Games.id') } }
                            ]
                        }
                    },
                    {
                        model: db.Stats, as: `awayStats`, required: true,
                        where: {
                            [Op.and]: [
                                { teamId: { [Op.eq]: Sequelize.col('Games.awayTeam') } },
                                { gameId: { [Op.eq]: Sequelize.col('Games.id') } }
                            ]
                        }
                    }], order: [['commence_time', 'ASC']], raw: true
            });

            const hyperParamScore = await trainSportModelKFold(testSport, pastGames, true, upcomingGames);

            return {
                loss: -hyperParamScore,     // minimize negative hyperParamScore (i.e. maximize hyperParamScore)
            };
        }

        // Initialize the optimizer
        const optimizer = new BayesianOptimizer({
        });
        await optimizer.optimize(objective, space, 15);
        // Get the best parameters found
        const bestParams = optimizer.getBestParams();
        console.log(`Best Parameters for ${sport.name}:`, bestParams);

        const processedParams = {
            learningRate: bestParams.learningRate,
            l2Reg: bestParams.l2reg,
            dropoutReg: bestParams.dropoutReg,
            batchSize: roundToNearest(bestParams.batchSize, validBatchSizes),
            epochs: Math.round(bestParams.epochs),
            hiddenLayerNum: Math.round(bestParams.hiddenLayerNum),
            layerNeurons: roundToNearest(bestParams.layerNeurons, validLayerNeurons),
            kFolds: Math.round(bestParams.kFolds),
            historyLength: Math.round(bestParams.historyLength),
            gameDecayValue: bestParams.gameDecayValue,
            decayStepSize: Math.round(bestParams.decayStepSize)
        };
        console.log(`Processed Parameters for ${sport.name}:`, processedParams);
        await db.HyperParams.update({
            epochs: processedParams.epochs,
            batchSize: processedParams.batchSize,
            learningRate: processedParams.learningRate,
            l2Reg: processedParams.l2Reg,
            dropoutReg: processedParams.dropoutReg,
            hiddenLayers: processedParams.hiddenLayerNum,
            layerNeurons: processedParams.layerNeurons,
            kFolds: processedParams.kFolds,
            historyLength: processedParams.historyLength,
            decayFactor: processedParams.gameDecayValue,
            gameDecayThreshold: processedParams.decayStepSize
        }, {
            where: {
                sport: sport.id
            }
        })

    }
    console.log(`FINISHED HYPERPARAM SEARCH @ ${moment().format('HH:mm:ss')}`)
}
//TODO: STORE THIS FOR LATER
const valueBetGridSearch = async (sport) => {
    console.log(`STARTING VALUE BET SEARCH @ ${moment().format('HH:mm:ss')}`)
    const sportsbooks = [
        'betonlineag',
        'betmgm',
        'betrivers',
        'betus',
        'bovada',
        'williamhill_us',
        'draftkings',
        'fanatics',
        'fanduel',
        'lowvig',
        'mybookieag',
        'ballybet',
        'betanysports',
        'betparx',
        'espnbet',
        'fliff',
        'hardrockbet',
        'windcreek'
    ];
    let indexDiffSmallNum = [-50, -40, -30, -20, -10, 0, 10, 20, 30, 45, 50];
    let indexDiffRangeNum = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    let confidenceLowNum = [.50, .55, .60, .65, .70, .75, .80, .85, .90, .95, 1.00];
    let confidenceRangeNum = [0, .05, .10, .15, .20, .25, .30, .35, .40, .45, .50];


        let sportGames = await db.Games.findAll({
            where: { sport_key: sport.name, predictedWinner: { [Op.in]: ['home', 'away'] }, complete: true }, include: [
                {
                    model: db.Teams,
                    as: 'homeTeamDetails', // alias for HomeTeam join
                    // No where clause needed here
                },
                {
                    model: db.Teams,
                    as: 'awayTeamDetails', // alias for AwayTeam join
                },
                {
                    model: db.Bookmakers,
                    as: 'bookmakers',
                    where: {
                        gameId: { [Op.eq]: Sequelize.col('Games.id') } // Ensure the gameId matches the Games table
                    },
                    include: [
                        {
                            model: db.Markets,
                            as: 'markets',
                            where: {
                                bookmakerId: { [Op.eq]: Sequelize.col('bookmakers.id') } // Ensure the bookmakerId matches the Bookmakers table
                            },
                            include: [
                                {
                                    model: db.Outcomes,
                                    as: 'outcomes',
                                    where: {
                                        marketId: { [Op.eq]: Sequelize.col('bookmakers->markets.id') } // Ensure the marketId matches the Markets table
                                    }
                                }
                            ]
                        }
                    ]
                },
            ]
        })
        let plainGames = sportGames.map(game => game.get({ plain: true })); // Convert Sequelize instances to plain objects
        if (sport.name === 'baseball_mlb') {
            // Parallelize across sportsbooks
            for (const sportsbook of sportsbooks) {
                let sportsbookSettings = await db.ValueBetSettings.findOne({ where: { bookmaker: sportsbook, sport: sport.id }, raw: true });
                let storeCI =
                    sportsbookSettings?.bestConfidenceInterval ||
                    { lower: 0, upper: 0 }
                let bestCIScore =
                    // sportsbookSettings?.bestCISCore || 
                    0
                let finalSettings = {
                    bookmaker: sportsbook,
                    settings: {
                        // winPercentIncrease: 0,
                        indexDiffSmallNum: sportsbookSettings?.indexDiffSmall || 0,
                        indexDiffRangeNum: sportsbookSettings?.indexDiffRange || 0,
                        confidenceLowNum: sportsbookSettings?.confidenceSmall || 0,
                        confidenceRangeNum: sportsbookSettings?.confidenceRange || 0,
                    }

                };
                for (const indexDifSmall of indexDiffSmallNum) {
                    for (const indexDiffRange of indexDiffRangeNum) {
                        for (const confidenceLow of confidenceLowNum) {
                            for (const confidenceRange of confidenceRangeNum) {
                                let totalGames = plainGames.filter((game) => {
                                    const bookmaker = game.bookmakers.find(b => b.key === sportsbook);
                                    if (!bookmaker) return false;

                                    const market = bookmaker.markets.find(m => m.key === 'h2h');
                                    if (!market || !market.outcomes) return false;

                                    const indexDiff = game.predictedWinner === 'home' ?
                                        game.homeTeamScaledIndex - game.awayTeamScaledIndex :
                                        game.awayTeamScaledIndex - game.homeTeamScaledIndex;

                                    const predictionConfidence = game.predictionConfidence;

                                    return market.outcomes.some(o => {
                                        const isCorrectTeam = (
                                            (game.predictedWinner === 'home' && game.homeTeamDetails.espnDisplayName === o.name) ||
                                            (game.predictedWinner === 'away' && game.awayTeamDetails.espnDisplayName === o.name)
                                        );
                                        return (
                                            indexDiff >= indexDifSmall &&
                                            indexDiff < (indexDifSmall + indexDiffRange) &&
                                            predictionConfidence > confidenceLow &&
                                            predictionConfidence < (confidenceLow + confidenceRange) &&
                                            // (o.impliedProbability * 100) < game.winPercent &&
                                            isCorrectTeam
                                        );
                                    });
                                });

                                let correctGames = totalGames.filter((game) => game.predictionCorrect === true);
                                let winRate = totalGames.length > 0 ? correctGames.length / totalGames.length : 0;
                                function calculateConfidenceInterval(winrate, sampleSize, confidenceLevel) {
                                    // Define z-scores for common confidence levels
                                    const zScores = {
                                        90: 1.645,  // Z-score for 90% confidence
                                        95: 1.96,   // Z-score for 95% confidence
                                        99: 2.576   // Z-score for 99% confidence
                                    };

                                    // Check if the confidence level is valid
                                    if (!zScores[confidenceLevel]) {
                                        throw new Error('Invalid confidence level. Use 90, 95, or 99.');
                                    }

                                    // Calculate the z-score for the given confidence level
                                    const z = zScores[confidenceLevel];

                                    // Calculate the margin of error
                                    const marginOfError = z * Math.sqrt((winrate * (1 - winrate)) / sampleSize);

                                    // Calculate the confidence interval
                                    const lowerBound = winrate - marginOfError;
                                    const upperBound = winrate + marginOfError;

                                    // Return the result as an object
                                    return {
                                        lower: lowerBound,
                                        upper: upperBound
                                    };
                                }
                                let newCI
                                if (totalGames.length > plainGames.length / 20) { // Ensure we have enough games to calculate a meaningful CI
                                    newCI = calculateConfidenceInterval(winRate, totalGames.length, 95);

                                    const newScore = score(newCI, totalGames.length)
                                    if (newScore > bestCIScore) {
                                        storeCI = newCI
                                        finalWinrate = winRate;
                                        finalTotalGames = totalGames.length;
                                        bestCIScore = newScore
                                        finalSettings.settings = {
                                            indexDiffSmallNum: indexDifSmall,
                                            indexDiffRangeNum: indexDiffRange,
                                            confidenceLowNum: confidenceLow,
                                            confidenceRangeNum: confidenceRange,
                                            bestWinrate: winRate,
                                            bestTotalGames: totalGames.length,
                                            bestConfidenceInterval: storeCI,
                                            bestCIScore: bestCIScore
                                        };
                                        await db.ValueBetSettings.update({
                                            indexDiffSmall: finalSettings.settings.indexDiffSmallNum,
                                            indexDiffRange: finalSettings.settings.indexDiffRangeNum,
                                            confidenceSmall: finalSettings.settings.confidenceLowNum,
                                            confidenceRange: finalSettings.settings.confidenceRangeNum,
                                            bestWinrate: finalSettings.settings.bestWinrate,
                                            bestTotalGames: finalSettings.settings.bestTotalGames,
                                            bestConfidenceInterval: finalSettings.settings.bestConfidenceInterval,
                                            bestCIScore: bestCIScore
                                        }, {
                                            where: {
                                                bookmaker: sportsbook,
                                                sport: sport.id
                                            },
                                        })
                                    }
                                }
                            }
                        }
                    }
                }
                if (sportsbook === 'fanduel') {
                    console.log(sport.name)
                    console.log('New Best Settings: ', finalSettings)
                }

            };
        }
    
};



module.exports = { hyperparameterRandSearch, valueBetGridSearch }