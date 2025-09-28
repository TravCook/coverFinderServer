const moment = require('moment')
const { Odds, PastGameOdds, Sport } = require('../../../models');
const db = require('../../../models_sql');
const Sequelize = require('sequelize');
const { Op } = Sequelize;
const tf = require('@tensorflow/tfjs-node');
const { trainSportModelKFold } = require('../../helperFunctions/mlModelFuncs/trainingHelpers')
const cliProgress = require('cli-progress');
const fs = require('fs');
const path = require('path');
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

    return ciMidpoint - ciWidthPenalty + (sizeBonus * .01); // tune 0.01 as weight
};

const calculateProfitFromUSOdds = (odds, stake) => {
    if (odds > 0) {
        return (odds / 100) * stake;
    } else {
        return (100 / Math.abs(odds)) * stake;
    }
};



const hyperparameterRandSearch = async (sports) => {
    console.log(`STARTING HYPERPARAM SEARCH @ ${moment().format('HH:mm:ss')}`);







    for (let sport of sports.sort((a, b) => a.startMonth - b.startMonth)) {
        if( sport.name !== 'americanfootball_nfl') continue; // Skip college football for now
        const useDropoutReg = ( sport.name === 'basketball_nba' || sport.name === 'icehockey_nhl');
        let space = {
            learningRate: { type: 'log', min: 1e-5, max: 5e-3 },
            batchSize: { type: 'int', min: 0, max: 3 }, // 0 = 16, 1 = 32, ...
            epochs: { type: 'int', min: 30, max: 100 },
            hiddenLayerNum: { type: 'int', min: 4, max: 8 },
            layerNeurons: { type: 'int', min: 0, max: 2 }, // 0 = 64, 1 = 128, 2 = 256
            // l2reg: { type: 'log', min: 1e-5, max: 5e-2 },
            kFolds: { type: 'int', min: 3, max: 6 },
            historyLength: { type: 'int', min: 30, max: 100 },
            gameDecayValue: { type: 'float', min: 0.60, max: 0.99 },
            decayStepSize: { type: 'int', min: 5, max: 80 },
            scoreLossWeight: { type: 'float', min: 2.0, max: 8.0 },
            winPctLossWeight: { type: 'float', min: 0.3, max: 4.0 },
            earlyStopPatience: { type: 'int', min: 4, max: 10 }
        };
        if (useDropoutReg) {
            space = {
                learningRate: { type: 'log', min: 1e-5, max: 5e-3 },
                batchSize: { type: 'int', min: 0, max: 3 }, // 0 = 16, 1 = 32, ...
                epochs: { type: 'int', min: 30, max: 100 },
                hiddenLayerNum: { type: 'int', min: 4, max: 8 },
                layerNeurons: { type: 'int', min: 0, max: 2 }, // 0 = 64, 1 = 128, 2 = 256
                // l2reg: { type: 'log', min: 1e-5, max: 5e-2 },
                dropoutReg: { type: 'float', min: 0.0, max: 0.3 },
                kFolds: { type: 'int', min: 3, max: 6 },
                historyLength: { type: 'int', min: 30, max: 100 },
                gameDecayValue: { type: 'float', min: 0.60, max: 0.99 },
                decayStepSize: { type: 'int', min: 5, max: 80 },
                scoreLossWeight: { type: 'float', min: 2.0, max: 8.0 },
                winPctLossWeight: { type: 'float', min: 0.3, max: 4.0 },
                earlyStopPatience: { type: 'int', min: 4, max: 10 }
            };
        }

        // if(sport.name !== 'basketball_wncaab' ) continue; // Skip baseball for now
        const batchSizeOptions = [16, 32, 64, 128];
        const neuronOptions = [64, 128, 256];

        console.log(`--------------- ${sport.name} @ ${moment().format('HH:mm:ss')} -------------------`);


        async function objective(params) {


            const sanitizedParams = {
                learningRate: params.learningRate,
                // l2reg: params.l2reg,
                dropoutReg: params.dropoutReg,
                batchSize: batchSizeOptions[Math.round(params.batchSize)],
                epochs: Math.round(params.epochs),
                hiddenLayerNum: Math.round(params.hiddenLayerNum),
                layerNeurons: neuronOptions[Math.round(params.layerNeurons)],
                kFolds: Math.round(params.kFolds),
                historyLength: Math.round(params.historyLength),
                gameDecayValue: params.gameDecayValue,
                decayStepSize: Math.round(params.decayStepSize),
                scoreLossWeight: params.scoreLossWeight,
                winPctLossWeight: params.winPctLossWeight,
                earlyStopPatience: Math.round(params.earlyStopPatience)
            };

            const testSport = {
                ...sport,
                hyperParameters: sanitizedParams
            };

            const upcomingGames = await db.Games.findAll({
                where: { sport_key: sport.name, complete: false }
            });

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
                    }
                ],
                order: [['commence_time', 'ASC']],
                raw: true
            });

            const hyperParamScore = await trainSportModelKFold(testSport, pastGames, true, upcomingGames);


            return {
                loss: -hyperParamScore // We want to maximize this, so minimize negative
            };
        }

        const optimizer = new BayesianOptimizer({});
        await optimizer.optimize(objective, space, 9);

        const bestParams = optimizer.getBestParams();


        const processedParams = {
            learningRate: bestParams.learningRate,
            // l2Reg: bestParams.l2reg,
            dropoutReg: bestParams.dropoutReg,
            batchSize: batchSizeOptions[Math.round(bestParams.batchSize)],
            epochs: Math.round(bestParams.epochs),
            hiddenLayers: Math.round(bestParams.hiddenLayerNum),
            layerNeurons: neuronOptions[Math.round(bestParams.layerNeurons)],
            kFolds: Math.round(bestParams.kFolds),
            historyLength: Math.round(bestParams.historyLength),
            decayFactor: bestParams.gameDecayValue,
            gameDecayThreshold: Math.round(bestParams.decayStepSize),
            scoreLoss: bestParams.scoreLossWeight,
            winPctLoss: bestParams.winPctLossWeight,
            earlyStopPatience: Math.round(bestParams.earlyStopPatience)
        };
        console.log(`Best Parameters for ${sport.name}:`, processedParams);
        await db.HyperParams.update(processedParams, {
            where: { sport: sport.id }
        });
        tf.disposeVariables();
        tf.engine().reset();

    }

    console.log(`✅ FINISHED HYPERPARAM SEARCH @ ${moment().format('HH:mm:ss')}`);
};
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
    // if (sport.name === 'baseball_mlb') {
    // Parallelize across sportsbooks
    console.log(`${new Date(sportGames[0]?.commence_time)} - ${new Date(sportGames[sportGames.length - 1]?.commence_time)} | Total Games: ${plainGames.length}`)
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
        let bestProfit = -Infinity;
        let bestROI = -Infinity;

        for (const indexDifSmall of indexDiffSmallNum) {
            for (const indexDiffRange of indexDiffRangeNum) {
                for (const confidenceLow of confidenceLowNum) {
                    for (const confidenceRange of confidenceRangeNum) {
                        let filteredGames = plainGames.filter((game) => {
                            const bookmaker = game.bookmakers.find(b => b.key === sportsbook);
                            if (!bookmaker) return false;

                            const market = bookmaker.markets.find(m => m.key === 'h2h');
                            if (!market || !market.outcomes) return false;

                            const indexDiff = game.predictedWinner === 'home'
                                ? game.homeTeamScaledIndex - game.awayTeamScaledIndex
                                : game.awayTeamScaledIndex - game.homeTeamScaledIndex;

                            const predictionConfidence = game.predictionConfidence;

                            return market.outcomes.some(o => {
                                const isCorrectTeam =
                                    (game.predictedWinner === 'home' && o.name === game.homeTeamDetails.espnDisplayName) ||
                                    (game.predictedWinner === 'away' && o.name === game.awayTeamDetails.espnDisplayName);

                                return (
                                    indexDiff >= indexDifSmall &&
                                    indexDiff < (indexDifSmall + indexDiffRange) &&
                                    predictionConfidence > confidenceLow &&
                                    predictionConfidence < (confidenceLow + confidenceRange) &&
                                    isCorrectTeam
                                );
                            });
                        });

                        // Calculate total profit
                        let netProfit = filteredGames.reduce((acc, game) => {
                            const bookmaker = game.bookmakers.find(b => b.key === sportsbook);
                            const market = bookmaker?.markets.find(m => m.key === 'h2h');
                            const outcome = market?.outcomes.find(o =>
                                (game.predictedWinner === 'home' && o.name === game.homeTeamDetails.espnDisplayName) ||
                                (game.predictedWinner === 'away' && o.name === game.awayTeamDetails.espnDisplayName)
                            );

                            if (!outcome) return acc;

                            if (game.predictionCorrect === true) {
                                return acc + calculateProfitFromUSOdds(outcome.price, 1);
                            } else if (game.predictionCorrect === false) {
                                return acc - 1;
                            }

                            return acc;
                        }, 0);

                        let roi = filteredGames.length > 0 ? (netProfit / filteredGames.length) * 100 : -Infinity;

                        if (roi > bestROI && filteredGames.length > plainGames.length / 5) {
                            bestROI = roi;

                            finalSettings.settings = {
                                indexDiffSmallNum: indexDifSmall,
                                indexDiffRangeNum: indexDiffRange,
                                confidenceLowNum: confidenceLow,
                                confidenceRangeNum: confidenceRange,
                                bestProfit: netProfit,
                                bestROI: roi,
                                bestTotalGames: filteredGames.length
                            };

                            await db.ValueBetSettings.update({
                                indexDiffSmall: indexDifSmall,
                                indexDiffRange: indexDiffRange,
                                confidenceSmall: confidenceLow,
                                confidenceRange: confidenceRange,
                                bestProfit: netProfit,
                                bestTotalGames: filteredGames.length
                            }, {
                                where: {
                                    bookmaker: sportsbook,
                                    sport: sport.id
                                }
                            });
                        }
                    }
                }
            }
        }

        // for (const indexDifSmall of indexDiffSmallNum) {
        //     for (const indexDiffRange of indexDiffRangeNum) {
        //         for (const confidenceLow of confidenceLowNum) {
        //             for (const confidenceRange of confidenceRangeNum) {
        //                 let totalGames = plainGames.filter((game) => {
        //                     const bookmaker = game.bookmakers.find(b => b.key === sportsbook);
        //                     if (!bookmaker) return false;

        //                     const market = bookmaker.markets.find(m => m.key === 'h2h');
        //                     if (!market || !market.outcomes) return false;

        //                     const indexDiff = game.predictedWinner === 'home' ?
        //                         game.homeTeamScaledIndex - game.awayTeamScaledIndex :
        //                         game.awayTeamScaledIndex - game.homeTeamScaledIndex;

        //                     const predictionConfidence = game.predictionConfidence;

        //                     return market.outcomes.some(o => {
        //                         const isCorrectTeam = (
        //                             (game.predictedWinner === 'home' && game.homeTeamDetails.espnDisplayName === o.name) ||
        //                             (game.predictedWinner === 'away' && game.awayTeamDetails.espnDisplayName === o.name)
        //                         );
        //                         return (
        //                             indexDiff >= indexDifSmall &&
        //                             indexDiff < (indexDifSmall + indexDiffRange) &&
        //                             predictionConfidence > confidenceLow &&
        //                             predictionConfidence < (confidenceLow + confidenceRange) &&
        //                             // (o.impliedProbability * 100) < game.winPercent &&
        //                             isCorrectTeam
        //                         );
        //                     });
        //                 });

        //                 let correctGames = totalGames.filter((game) => game.predictionCorrect === true);
        //                 let winRate = totalGames.length > 0 ? correctGames.length / totalGames.length : 0;
        //                 function calculateConfidenceInterval(winrate, sampleSize, confidenceLevel) {
        //                     // Define z-scores for common confidence levels
        //                     const zScores = {
        //                         90: 1.645,  // Z-score for 90% confidence
        //                         95: 1.96,   // Z-score for 95% confidence
        //                         99: 2.576   // Z-score for 99% confidence
        //                     };

        //                     // Check if the confidence level is valid
        //                     if (!zScores[confidenceLevel]) {
        //                         throw new Error('Invalid confidence level. Use 90, 95, or 99.');
        //                     }

        //                     // Calculate the z-score for the given confidence level
        //                     const z = zScores[confidenceLevel];

        //                     // Calculate the margin of error
        //                     const marginOfError = z * Math.sqrt((winrate * (1 - winrate)) / sampleSize);

        //                     // Calculate the confidence interval
        //                     const lowerBound = winrate - marginOfError;
        //                     const upperBound = winrate + marginOfError;

        //                     // Return the result as an object
        //                     return {
        //                         lower: lowerBound,
        //                         upper: upperBound
        //                     };
        //                 }
        //                 let newCI
        //                 if (totalGames.length > plainGames.length / 5) { // Ensure we have enough games to calculate a meaningful CI
        //                     newCI = calculateConfidenceInterval(winRate, totalGames.length, 95);

        //                     const newScore = score(newCI, totalGames.length)
        //                     if(sport.name === 'americanfootball_ncaaf' && sportsbook === 'fanduel')
        //                     // console.log(`Settings: ${sport.name} | ${sportsbook} | indexDiffSmall: ${indexDifSmall}, indexDiffRange: ${indexDiffRange}, confidenceLow: ${confidenceLow}, confidenceRange: ${confidenceRange} => Total Games: ${totalGames.length}, Correct Games: ${correctGames.length} (${(winRate * 100).toFixed(2)}%), CI: [${(newCI.lower * 100).toFixed(2)}%, ${(newCI.upper * 100).toFixed(2)}%], CI Score: ${newScore.toFixed(4)}`);

        //                     if (newScore > bestCIScore) {
        //                         storeCI = newCI
        //                         finalWinrate = winRate;
        //                         finalTotalGames = totalGames.length;
        //                         bestCIScore = newScore
        //                         finalSettings.settings = {
        //                             indexDiffSmallNum: indexDifSmall,
        //                             indexDiffRangeNum: indexDiffRange,
        //                             confidenceLowNum: confidenceLow,
        //                             confidenceRangeNum: confidenceRange,
        //                             bestWinrate: winRate,
        //                             bestTotalGames: correctGames.length,
        //                             bestConfidenceInterval: storeCI,
        //                             bestCIScore: bestCIScore
        //                         };
        //                         await db.ValueBetSettings.update({
        //                             indexDiffSmall: finalSettings.settings.indexDiffSmallNum,
        //                             indexDiffRange: finalSettings.settings.indexDiffRangeNum,
        //                             confidenceSmall: finalSettings.settings.confidenceLowNum,
        //                             confidenceRange: finalSettings.settings.confidenceRangeNum,
        //                             bestWinrate: finalSettings.settings.bestWinrate,
        //                             bestTotalGames: finalSettings.settings.bestTotalGames,
        //                             bestConfidenceInterval: finalSettings.settings.bestConfidenceInterval,
        //                             bestCIScore: bestCIScore
        //                         }, {
        //                             where: {
        //                                 bookmaker: sportsbook,
        //                                 sport: sport.id
        //                             },
        //                         })
        //                     }
        //                 }
        //             }
        //         }
        //     }
        // }
        if (sportsbook === 'fanduel') {
            console.log(sport.name)
            console.log('New Best Settings: ', finalSettings)
        }

    };
    // }

};



module.exports = { hyperparameterRandSearch, valueBetGridSearch }