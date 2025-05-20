const moment = require('moment')
const { Odds, PastGameOdds, Sport } = require('../../../models');
const { trainSportModelKFold } = require('../../helperFunctions/mlModelFuncs/trainingHelpers')
const fs = require('fs');

// TODO:COMBINE THIS RANDOM SEARCH WITH VALUE BET RANDOM SEARCH TO RUN ONCE A WEEK TO DETERMINE OPTIMAL SETTINGS
const hyperparameterRandSearch = async (sports) => {
    console.log(`STARTING HYPERPARAM SEARCH @ ${moment().format('HH:mm:ss')}`)


    const paramSpace = {
        //ALL REAL VALUES FOR HYPERPARAMS -- UNTESTABLE FOR NOW
        // learningRate: [.00001, .0001, .001, .01, .1],  
        // batchSize: [32, 64, 128],  
        // epochs: [50, 100, 200],   
        // l2Reg: [.00001, .0001, .001, .01, .1],
        // dropoutReg: [.2, .25, .3, .35, .4, .45, .5],       
        // hiddenLayerNum: [4, 6, 8, 10],
        // kernalInitializer: ['glorotNormal', 'heNormal', 'heUniform', 'glorotNormal'],   
        // KFolds: [2, 5, 8, 10],                  
        // layerNeurons: [64, 128, 256],                                        
        // decayFactor: [1, .75, .5, .25],
        // gameDecayThreshold: [10, 50, 100, 250]
        //TRIMMED VALUES FOR BASELINE HYPERPARAMS
        learningRate: [0.001, 0.01, 0.1],             
        batchSize: [32, 64, 128],                     
        epochs: [50, 100],                            
        l2Reg: [0.0001, 0.001],                       
        dropoutReg: [0.25, 0.3, 0.35],                
        hiddenLayerNum: [4, 6, 8],                    
        kernalInitializer: ['glorotNormal', 'heNormal'], 
        KFolds: [5],                                  
        layerNeurons: [64, 128, 256],                 
        decayFactor: [1, 0.75],                       
        gameDecayThreshold: [10, 50, 100]                     
    }

    let upcomingGames = await Odds.find()

    for (let sport of sports) {
        let bestAccuracy= 0
        let bestParams = {}
        console.log(`--------------- ${sport.name} @ ${moment().format('HH:mm:ss')}-------------------`)
        let gameData = await PastGameOdds.find({ sport_key: sport.name }).sort({ commence_time: -1 })
        let sportGames = upcomingGames.filter((game) => game.sport_key === sport.name)
        console.log(`Upcoming Games: ${sportGames.length}`)
        if (gameData.length > 0 && sportGames.length > 0) {
            // 1296
            for (let iterations = 0; iterations < 10; iterations++) {
                let currentParams = {}

                for (const param in paramSpace) {
                    const values = paramSpace[param]

                    const randomIndex = Math.floor(Math.random() * values.length)
                    currentParams[param] = values[randomIndex]
                }

                let testSport = {
                    ...sport,
                    hyperParameters: currentParams
                }

                // console.log(testSport)
                let avgF1Score = await trainSportModelKFold(testSport, gameData, true)
                console.log(avgF1Score)
                if(avgF1Score > bestAccuracy) {
                    bestAccuracy = avgF1Score
                    bestParams = currentParams
                }

            }
            let accuracyComparison = sport?.hyperParameters?.bestAccuracy || 0
            console.log('Current Accuracy:', accuracyComparison);
            console.log('Best Accuracy:', bestAccuracy);
            if (bestAccuracy > accuracyComparison) {
                await Sport.findOneAndUpdate({ name: sport.name }, {
                    hyperParameters: bestParams
                }, { upsert: true })

                const modelDir = `./model_checkpoint/${sport.name}_model`;

                fs.rmdirSync(modelDir, { recursive: true });
            }

        }


    }
    console.log(`FINISHED HYPERPARAM SEARCH @ ${moment().format('HH:mm:ss')}`)
}
//TODO: STORE THIS FOR LATER
const valueBetGridSearch = async (sports) => {
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
    let indexDiffSmallNum = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45];
    let indexDiffRangeNum = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45];
    let confidenceLowNum = [.50, .55, .60, .65, .70, .75, .80, .85, .90, .95, 1.00];
    let confidenceRangeNum = [0, .05, .10, .15, .20, .25, .30, .35, .40, .45, .50];

    for (const sport of sports) {
        let sportGames = await PastGameOdds.find({ sport_key: sport.name, predictedWinner: { $in: ['home', 'away'] } });

        if (sportGames.length > 0) {
            // Parallelize across sportsbooks
            for (const sportsbook of sportsbooks) {
                let sportsbookSettings = sport.valueBetSettings?.find((setting) => setting.bookmaker === sportsbook)
                let storeCI =
                    // sportsbookSettings?.settings.bestConfidenceInterval ||
                    { lower: 0, upper: 0 }
                let finalSettings = {
                    bookmaker: sportsbook,
                    settings: {
                        // winPercentIncrease: 0,
                        indexDiffSmallNum: 0,
                        indexDiffRangeNum: 0,
                        confidenceLowNum: 0,
                        confidenceRangeNum: 0
                    }

                };
                for (const indexDifSmall of indexDiffSmallNum) {
                    for (const indexDiffRange of indexDiffRangeNum) {
                        for (const confidenceLow of confidenceLowNum) {
                            for (const confidenceRange of confidenceRangeNum) {
                                let totalGames = sportGames.filter((game) => {
                                    const bookmaker = game.bookmakers.find(bookmaker => bookmaker.key === sportsbook);
                                    if (bookmaker) {
                                        const outcome = bookmaker.markets.find(market => market.key === 'h2h').outcomes;
                                        const lowerImpliedProbOutcome = outcome.find(o => (
                                            ((game.predictedWinner === 'home' ? Math.abs(game.homeTeamScaledIndex - game.awayTeamScaledIndex) : Math.abs(game.awayTeamScaledIndex - game.homeTeamScaledIndex)) > (indexDifSmall) &&
                                                (game.predictedWinner === 'home' ? Math.abs(game.homeTeamScaledIndex - game.awayTeamScaledIndex) : Math.abs(game.awayTeamScaledIndex - game.homeTeamScaledIndex)) < (indexDifSmall + indexDiffRange)) &&
                                            (game.predictionStrength > confidenceLow && game.predictionStrength < (confidenceLow + confidenceRange)) &&
                                            (o.impliedProb * 100) < (game.winPercent) &&
                                            ((game.predictedWinner === 'home' && game.home_team === o.name) || (game.predictedWinner === 'away' && game.away_team === o.name))
                                        ));
                                        return lowerImpliedProbOutcome !== undefined;
                                    }
                                    return false;
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

                                if (totalGames.length > 10) {

                                    newCI = calculateConfidenceInterval(winRate, totalGames.length, 90);
                                    const SEPARATION_THRESHOLD = 0.02; // 2% gap
                                    const MAX_CI_WIDTH = 0.15; // Maximum allowable CI width (15%)
                                    if (
                                        newCI.upper > storeCI.lower + SEPARATION_THRESHOLD &&  // Ensure a clear upper bound gap
                                        (newCI.upper - newCI.lower) < MAX_CI_WIDTH &&         // Ensure the CI is not too wide
                                        newCI.upper > storeCI.upper   // Ensure the new CI's upper bound is better                   
                                    ) {
                                        storeCI = newCI
                                        finalWinrate = winRate;
                                        finalTotalGames = totalGames.length;
                                        finalSettings.settings = {
                                            indexDiffSmallNum: indexDifSmall,
                                            indexDiffRangeNum: indexDiffRange,
                                            confidenceLowNum: confidenceLow,
                                            confidenceRangeNum: confidenceRange,
                                            bestWinrate: winRate,
                                            bestTotalGames: totalGames.length,
                                            bestConfidenceInterval: storeCI
                                        };
                                        let sportExist = await Sport.find({
                                            name: sport.name,
                                            valueBetSettings: {
                                                $elemMatch: {
                                                    bookmaker: sportsbook
                                                }
                                            }
                                        });
                                        if (sportExist.length === 0) {
                                            await Sport.findOneAndUpdate(
                                                { name: sport.name }, // Find the sport by name
                                                {
                                                    // Update the main fields (statYear, decayFactor, etc.)
                                                    $set: {
                                                        name: sport.name,
                                                        espnSport: sport.espnSport,
                                                        league: sport.league,
                                                        startMonth: sport.startMonth,
                                                        endMonth: sport.endMonth,
                                                        multiYear: sport.multiYear,
                                                        statYear: sport.statYear,
                                                    },
                                                    $addToSet: {
                                                        valueBetSettings: {
                                                            bookmaker: sportsbook,
                                                            settings: finalSettings.settings
                                                        }
                                                    }
                                                },
                                                { upsert: true, new: true } // upsert creates the document if it doesn't exist, new returns the updated doc
                                            );
                                        } else {
                                            await Sport.findOneAndUpdate(
                                                { name: sport.name }, // Find the sport by name
                                                {
                                                    // Update the main fields (statYear, decayFactor, etc.)
                                                    $set: {
                                                        name: sport.name,
                                                        espnSport: sport.espnSport,
                                                        league: sport.league,
                                                        startMonth: sport.startMonth,
                                                        endMonth: sport.endMonth,
                                                        multiYear: sport.multiYear,
                                                        statYear: sport.statYear,
                                                    },
                                                    $set: {
                                                        // Update the settings for the specific bookmaker using the $[] positional operator
                                                        "valueBetSettings.$[elem].settings": finalSettings.settings
                                                    }
                                                },
                                                { arrayFilters: [{ "elem.bookmaker": sportsbook }], upsert: true, new: true } // upsert creates the document if it doesn't exist, new returns the updated doc
                                            );
                                        }

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
    }
};

const valueBetRandomSearch = async (sports) => {
    console.log(`STARTING VALUE BET SEARCH @ ${moment().format('HH:mm:ss')}`)
    let pastGames = await PastGameOdds.find();
    let usableGames = pastGames.filter((game) => game.predictedWinner === 'home' || game.predictedWinner === 'away');

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

    // let winPercentIncrease = [-50, -45, -40, -35, -30, -25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
    let indexDiffSmallNum = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45];
    let indexDiffRangeNum = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45];
    let confidenceLowNum = [.50, .55, .60, .65, .70, .75, .80, .85, .90, .95, 1.00];
    let confidenceRangeNum = [0, .05, .10, .15, .20, .25, .30, .35, .40, .45, .50];

    const numRandomSamples = 10000; // Define how many random iterations you want to run
    for (const sport of sports) {

        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1; // getMonth() returns 0-11, so we add 1 to make it 1-12

        if (sport.name === 'baseball_mlb') {

            let sportGames = usableGames.filter((game) => game.sport_key === sport.name);
            if (sportGames.length > 0) {
                for (const sportsbook of sportsbooks) {
                    let sportsbookSettings = sport.valueBetSettings?.find((setting) => setting.bookmaker === sportsbook)
                    let storeCI = sportsbookSettings?.settings.bestConfidenceInterval || { lower: 0, upper: 0 }

                    let finalSettings = {
                        bookmaker: sportsbook,
                        settings: {
                            // winPercentIncrease: 0,
                            indexDiffSmallNum: 0,
                            indexDiffRangeNum: 0,
                            confidenceLowNum: 0,
                            confidenceRangeNum: 0
                        }

                    };

                    // Perform random search by selecting random values from each array
                    for (let i = 0; i < numRandomSamples; i++) {
                        // const winPercentInc = winPercentIncrease[Math.floor(Math.random() * winPercentIncrease.length)];
                        const indexDifSmall = indexDiffSmallNum[Math.floor(Math.random() * indexDiffSmallNum.length)];
                        const indexDiffRange = indexDiffRangeNum[Math.floor(Math.random() * indexDiffRangeNum.length)];
                        const confidenceLow = confidenceLowNum[Math.floor(Math.random() * confidenceLowNum.length)];
                        const confidenceRange = confidenceRangeNum[Math.floor(Math.random() * confidenceRangeNum.length)];

                        let totalGames = sportGames.filter((game) => {
                            const bookmaker = game.bookmakers.find(bookmaker => bookmaker.key === sportsbook);
                            if (bookmaker) {
                                const outcome = bookmaker.markets.find(market => market.key === 'h2h').outcomes;
                                const lowerImpliedProbOutcome = outcome.find(o => (
                                    ((game.predictedWinner === 'home' ? Math.abs(game.homeTeamScaledIndex - game.awayTeamScaledIndex) : Math.abs(game.awayTeamScaledIndex - game.homeTeamScaledIndex)) > (indexDifSmall) &&
                                        (game.predictedWinner === 'home' ? Math.abs(game.homeTeamScaledIndex - game.awayTeamScaledIndex) : Math.abs(game.awayTeamScaledIndex - game.homeTeamScaledIndex)) < (indexDifSmall + indexDiffRange)) &&
                                    (game.predictionStrength > confidenceLow && game.predictionStrength < (confidenceLow + confidenceRange)) &&
                                    (o.impliedProb * 100) < (game.winPercent) &&
                                    ((game.predictedWinner === 'home' && game.home_team === o.name) || (game.predictedWinner === 'away' && game.away_team === o.name))
                                ));
                                return lowerImpliedProbOutcome !== undefined;
                            }
                            return false;
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
                        if (totalGames.length > (sportGames.length / 20)) {
                            newCI = calculateConfidenceInterval(winRate, totalGames.length, 90);
                            const SEPARATION_THRESHOLD = 0.02; // 2% gap
                            const MAX_CI_WIDTH = 0.15; // Maximum allowable CI width (15%)

                            if (
                                newCI.upper > storeCI.lower + SEPARATION_THRESHOLD &&  // Ensure a clear upper bound gap
                                (newCI.upper - newCI.lower) < MAX_CI_WIDTH &&         // Ensure the CI is not too wide
                                newCI.upper > storeCI.upper &&   // Ensure the new CI's upper bound is better
                                newCI.lower > .50 // ensure the lower bound is at least 50%                          
                            ) {
                                storeCI = newCI
                                finalWinrate = winRate;
                                finalTotalGames = totalGames.length;
                                finalSettings.settings = {
                                    indexDiffSmallNum: indexDifSmall,
                                    indexDiffRangeNum: indexDiffRange,
                                    confidenceLowNum: confidenceLow,
                                    confidenceRangeNum: confidenceRange,
                                    bestWinrate: winRate,
                                    bestTotalGames: totalGames.length,
                                    bestConfidenceInterval: storeCI
                                };
                                let sportExist = await Sport.find({
                                    name: sport.name,
                                    valueBetSettings: {
                                        $elemMatch: {
                                            bookmaker: sportsbook
                                        }
                                    }
                                });
                                if (sportExist.length === 0) {
                                    await Sport.findOneAndUpdate(
                                        { name: sport.name }, // Find the sport by name
                                        {
                                            // Update the main fields (statYear, decayFactor, etc.)
                                            $set: {
                                                name: sport.name,
                                                espnSport: sport.espnSport,
                                                league: sport.league,
                                                startMonth: sport.startMonth,
                                                endMonth: sport.endMonth,
                                                multiYear: sport.multiYear,
                                                statYear: sport.statYear,
                                            },
                                            $addToSet: {
                                                valueBetSettings: {
                                                    bookmaker: sportsbook,
                                                    settings: finalSettings.settings
                                                }
                                            }
                                        },
                                        { upsert: true, new: true } // upsert creates the document if it doesn't exist, new returns the updated doc
                                    );
                                } else {
                                    await Sport.findOneAndUpdate(
                                        { name: sport.name }, // Find the sport by name
                                        {
                                            // Update the main fields (statYear, decayFactor, etc.)
                                            $set: {
                                                name: sport.name,
                                                espnSport: sport.espnSport,
                                                league: sport.league,
                                                startMonth: sport.startMonth,
                                                endMonth: sport.endMonth,
                                                multiYear: sport.multiYear,
                                                statYear: sport.statYear,
                                            },
                                            $set: {
                                                // Update the settings for the specific bookmaker using the $[] positional operator
                                                "valueBetSettings.$[elem].settings": finalSettings.settings
                                            }
                                        },
                                        { arrayFilters: [{ "elem.bookmaker": sportsbook }], upsert: true, new: true } // upsert creates the document if it doesn't exist, new returns the updated doc
                                    );
                                }
                                console.log('New Best Settings: ', finalSettings)
                            }
                        }

                    }
                    console.log(`Finished ${sportsbook} for ${sport.name}`)
                }
            }

        }

        console.log(`FINISHED VALUE BET SEARCH for ${sport.name} @ ${moment().format('HH:mm:ss')}`)
    }
    console.log(`FINISHED VALUE BET SEARCH @ ${moment().format('HH:mm:ss')}`)

};



module.exports = { valueBetRandomSearch, hyperparameterRandSearch, valueBetGridSearch }