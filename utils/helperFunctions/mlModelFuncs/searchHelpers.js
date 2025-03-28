const moment = require('moment')
const { Odds, PastGameOdds, UsaFootballTeam, BasketballTeam, BaseballTeam, HockeyTeam, Sport, Weights } = require('../../../models');
const { extractSportFeatures, trainSportModelKFold, handleSportWeights, evaluateMetrics, trainSportModel } = require('../../helperFunctions/mlModelFuncs/trainingHelpers')
const { normalizeTeamName, checkNaNValues } = require('../../helperFunctions/dataHelpers/dataSanitizers')
const fs = require('fs')
const tf = require('@tensorflow/tfjs-node');
// TODO:COMBINE THIS RANDOM SEARCH WITH VALUE BET RANDOM SEARCH TO RUN ONCE A WEEK TO DETERMINE OPTIMAL SETTINGS
const hyperparameterRandSearch = async (sports) => {
    console.log(`STARTING HYPERPARAM SEARCH @ ${moment().format('HH:mm:ss')}`)
    // const learningRates = [.00001, .0001, .001, .01, .1]
    // const batchSizes = [16, 32, 64, 128, 256]
    // const epochs = [10, 50, 100, 200]
    // const l2Regs = [.00001, .0001, .001, .01, .1]
    // const dropoutRegs = [.2, .25, .3, .35, .4, .45, .5]
    // const hiddenLayers = [2, 3, 4, 5, 6, 7, 8, 9, 10]
    // const kernalInitializers = ['glorotNormal', 'glorotUniform', 'heNormal', 'heUniform']
    // const numKFolds = [2, 3, 4, 5, 6, 7, 8, 9, 10]
    // const layerNeurons = [16, 32, 64, 128, 256, 512, 1000]

    const paramSpace = {
        learningRates: [.00001, .0001, .001, .01, .1],
        batchSizes: [16, 32, 64, 128, 256],
        epochs: [10, 50, 100, 200],
        l2Regs: [.00001, .0001, .001, .01, .1],
        dropoutRegs: [.2, .25, .3, .35, .4, .45, .5],
        hiddenLayers: [2, 3, 4, 5, 6, 7, 8, 9, 10],
        kernalInitializers: ['glorotNormal', 'glorotUniform', 'heNormal', 'heUniform'],
        numKFolds: [2, 3, 4, 5, 6, 7, 8, 9, 10],
        layerNeurons: [16, 32, 64, 128, 256, 512, 1000],
        decayFactors: [1, .75, .5, .25],
        gameDecayThresholds: [10, 50, 100, 250]
    }

    const createModel = async (learningRate, batchSize, epochs, l2Reg, dropoutReg, hiddenLayerNum, kernalinitializer, numKFolds, layerNeurons, xs) => {
        const model = tf.sequential()
        const l2Regularizer = tf.regularizers.l2({ l2: l2Reg });  // Adjust the value to suit your needs
        model.add(tf.layers.dense({ units: xs[0].length, inputShape: [xs[0].length], activation: 'relu', kernelInitializer: kernalinitializer, kernelRegularizer: l2Regularizer, biasInitializer: 'zeros' }));
        for (i = 0; i < hiddenLayerNum; i++) {
            model.add(tf.layers.dense({ units: layerNeurons, activation: 'relu', kernelInitializer: kernalinitializer, kernelRegularizer: l2Regularizer, biasInitializer: 'zeros' }));
            model.add(tf.layers.dropout({ rate: dropoutReg }));
        }
        model.add(tf.layers.dense({ units: 1, activation: 'sigmoid', kernelInitializer: kernalinitializer, kernelRegularizer: l2Regularizer, biasInitializer: 'zeros' }));

        model.compile({
            optimizer: tf.train.adam(learningRate),
            loss: 'binaryCrossentropy',
            metrics: ['accuracy']
        });

        return model
    }

    // Function to split data into k folds
    function getKFoldData(k, data) {
        const folds = [];
        const foldSize = Math.floor(data.length / k);

        for (let i = 0; i < k; i++) {
            const start = i * foldSize;
            const end = (i + 1) * foldSize;
            const fold = data.slice(start, end); // Get the i-th fold
            folds.push(fold);
        }

        return folds;
    }

    // Function to perform training and validation on each fold
    async function trainAndEvaluateKFold(model, k, X_train, y_train, epoch, batchSize) {
        const xArray = X_train.arraySync();  // Convert tensor to array
        const yArray = y_train.arraySync();  // Convert tensor to array


        const folds = getKFoldData(k, xArray);
        let foldAccuracies = [];

        for (let i = 0; i < k; i++) {
            const valFold = folds[i];
            const trainFolds = [...folds.slice(0, i), ...folds.slice(i + 1)].flat(); // Combine the remaining folds for training

            // Split into inputs and targets for this fold
            const [X_train_fold, y_train_fold] = [trainFolds.map(d => d[0]), trainFolds.map(d => d[1])];
            const [X_val_fold, y_val_fold] = [valFold.map(d => d[0]), valFold.map(d => d[1])];

            console.log(model)


            // Evaluate the model performance on the validation fold
            const evalResult = model.evaluate(X_val_fold, y_val_fold);
            const accuracy = evalResult[1].dataSync()[0]; // Get the accuracy score
            foldAccuracies.push(accuracy);
        }

        // Return the average accuracy across all folds
        const avgAccuracy = foldAccuracies.reduce((a, b) => a + b, 0) / foldAccuracies.length;
        return avgAccuracy;
    }
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1; // getMonth() returns 0-11, so we add 1 to make it 1-12


    for (let sport of sports) {
        let bestAccuracy = 0;
        let bestParams = {
            epochs: 10,
            batchSize: 16,
            KFolds: 2,
            hiddenLayerNum: 2,
            learningRate: .00001,
            l2Reg: .00001,
            dropoutReg: .2,
            layerNeurons: 16,
            kernalInitializer: 'glorotNormal',
            decayFactor: 1,
            gameDecayThreshold: 10
        };
        console.log(`--------------- ${sport.name}-------------------`)
        let gameData = await PastGameOdds.find({ sport_key: sport.name })
        if (gameData.length > 0) {
            if (sport.multiYear
                && ((currentMonth >= sport.startMonth && currentMonth <= 12) || (currentMonth >= 1 && currentMonth <= sport.endMonth))
                || !sport.multiYear
                && (currentMonth >= sport.startMonth && currentMonth <= sport.endMonth)) {

                for (let iterations = 0; iterations < 100; iterations++) {
                    let currentParams = {}

                    for (const param in paramSpace) {
                        const values = paramSpace[param]

                        const randomIndex = Math.floor(Math.random() * values.length)
                        currentParams[param] = values[randomIndex]
                    }





                    function decayCalcByGames(gamesProcessed, decayFactor) { //FOR USE TO DECAY BY GAMES PROCESSED
                        // Full strength for the last 25 games
                        const gamesDecayThreshold = currentParams.gameDecayThresholds;
                        if (gamesProcessed <= gamesDecayThreshold) {
                            return 1; // No decay for the most recent 25 games
                        } else {
                            // Apply decay based on the number of games processed
                            const decayFactorAdjusted = decayFactor;  // Use a default decay factor if none is provided
                            const decayAmount = Math.pow(decayFactorAdjusted, (gamesProcessed - gamesDecayThreshold));
                            return decayAmount;  // Decay decreases as the games processed increases
                        }
                    }
                    let xs = []
                    let ys = []
                    let gamesProcessed = 0; // Track how many games have been processed
                    // FOR USE TO DECAY BY GAMES PROCESSED
                    gameData.forEach(game => {
                        const homeStats = game.homeTeamStats;
                        const awayStats = game.awayTeamStats;

                        // Extract features based on sport
                        let features = extractSportFeatures(homeStats, awayStats, sport.name);
                        // Calculate decay based on the number of games processed
                        const decayWeight = decayCalcByGames(gamesProcessed, currentParams.decayFactors);  // get the decay weight based on gamesProcessed

                        // Apply decay to each feature
                        features = features.map(feature => feature * decayWeight);

                        // Set label to 1 if home team wins, 0 if away team wins
                        const correctPrediction = game.winner === 'home' ? 1 : 0;
                        checkNaNValues(features, game);  // Check features

                        xs.push(features);
                        ys.push(correctPrediction);

                        gamesProcessed++;  // Increment the counter for games processed
                    });
                    // Function to calculate dynamic class weights
                    const calculateClassWeights = (ys) => {

                        const homeWins = ys.filter(y => y === 1).length;   // Count the home wins (ys = 1)
                        const homeLosses = ys.filter(y => y === 0).length; // Count the home losses (ys = 0)


                        const totalExamples = homeWins + homeLosses;
                        const classWeightWin = totalExamples / (2 * homeWins);   // Weight for home wins
                        const classWeightLoss = totalExamples / (2 * homeLosses); // Weight for home losses

                        return {
                            0: classWeightLoss, // Weight for home losses
                            1: classWeightWin   // Weight for home wins
                        };
                    };

                    // Convert arrays to tensors
                    const xsTensor = tf.tensor2d(xs);

                    const ysTensor = tf.tensor2d(ys, [ys.length, 1]);

                    // Flatten ysTensor to convert it to a 1D array
                    const ysArray = await ysTensor.reshape([-1]).array();
                    // Dynamically calculate class weights
                    const classWeights = calculateClassWeights(ysArray);

                    // Create a fresh model for each hyperparameter combination
                    const model = await createModel(currentParams.learningRates, currentParams.batchSizes, currentParams.epochs, currentParams.l2Regs, currentParams.dropoutRegs, currentParams.hiddenLayerNums, currentParams.kernalInitializers, currentParams.numKFolds, currentParams.layerNeurons, xs);
                    // Perform K-Fold cross-validation with this hyperparameter combination
                    //const avgAccuracy = await trainAndEvaluateKFold(model, KFolds, xsTensor, ysTensor, epoch, batchSize); // 5-fold cross-validation
                    // Train the model on the current fold
                    await model.fit(xsTensor, ysTensor, {
                        epochs: currentParams.epoch, // Example epochs, you should set this dynamically
                        batchSize: currentParams.batchSize, // Example batch size, you should set this dynamically
                        validationSplit: 0.3,
                        classWeight: classWeights,
                        verbose: false,
                        shuffle: false,
                    });
                    const evaluation = model.evaluate(xsTensor, ysTensor);
                    const loss = evaluation[0].arraySync();
                    const accuracy = evaluation[1].arraySync();
                    // Now, calculate precision, recall, and F1-score

                    const metrics = evaluateMetrics(ysTensor, model.predict(xsTensor, { training: false }));

                    // // Track the best performing hyperparameters based on k-fold cross-validation
                    if (metrics.f1Score > bestAccuracy) {
                        bestAccuracy = metrics.f1Score;
                        bestParams = {
                            bestAccuracy: metrics.f1Score,
                            epochs: currentParams.epochs,
                            batchSize: currentParams.batchSizes,
                            KFolds: currentParams.numKFolds,
                            hiddenLayerNum: currentParams.hiddenLayers,
                            learningRate: currentParams.learningRates,
                            l2Reg: currentParams.l2Regs,
                            dropoutReg: currentParams.dropoutRegs,
                            kernalInitializer: currentParams.kernalInitializers,
                            layerNeurons: currentParams.layerNeurons,
                            decayFactor: currentParams.decayFactors,
                            gameDecayThreshold: currentParams.gameDecayThresholds
                        };
                    }

                }
                console.log('Best Hyperparameters:', bestParams);
                console.log('Best Cross-Validation Accuracy:', bestAccuracy);
                let currentSport = await Sport.findOne({ name: sport.name })

                let accuracyComparison = currentSport?.hyperParameters?.bestAccuracy || 0

                if (bestAccuracy > accuracyComparison) {
                    await Sport.findOneAndUpdate({ name: sport.name }, {
                        ...sport,
                        hyperParameters: bestParams
                    }, { upsert: true })

                    const modelPath = `./model_checkpoint/${sport.name}_model/model.json`;
                    try {
                        fs.unlinkSync(modelPath);
                        console.log('File deleted successfully');
                    } catch (err) {
                        console.error('Error deleting file:', err);
                    }
                }
            }
        }


    }
    console.log(`FINISHED HYPERPARAM SEARCH @ ${moment().format('HH:mm:ss')}`)
}
//TODO: STORE THIS FOR LATER
const valueBetGridSearch = async () => {
    let pastGames = await PastGameOdds.find();
    let usableGames = pastGames.filter((game) => game.predictedWinner === 'home' || game.predictedWinner === 'away');

    let sportsbooks = ['fanduel', 'betmgm', 'draftkings', 'betrivers'];
    let winPercentIncrease = [-50, -45, -40, -35, -30, -25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
    let indexDiffSmallNum = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45];
    let indexDiffRangeNum = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45];
    let confidenceLowNum = [.50, .55, .60, .65, .70, .75, .80, .85, .90, .95, 1.00];
    let confidenceRangeNum = [0, .05, .10, .15, .20, .25, .30, .35, .40, .45, .50];

    for (const sport of sports) {
        let sportGames = usableGames.filter((game) => game.sport_key === sport.name);


        if (sportGames.length > 0) {
            // Parallelize across sportsbooks
            await Promise.all(sportsbooks.map(async (sportsbook) => {
                let finalWinrate = 0;
                let finalTotalGames = 0
                let finalSettings = {
                    winPercentIncrease: 0,
                    indexDiffSmallNum: 0,
                    indexDiffRangeNum: 0,
                    confidenceLowNum: 0,
                    confidenceRangeNum: 0
                };
                for (const winPercentInc of winPercentIncrease) {
                    for (const indexDifSmall of indexDiffSmallNum) {
                        for (const indexDiffRange of indexDiffRangeNum) {
                            for (const confidenceLow of confidenceLowNum) {
                                for (const confidenceRange of confidenceRangeNum) {
                                    let totalGames = sportGames.filter((game) => {
                                        const bookmaker = game.bookmakers.find(bookmaker => bookmaker.key === sportsbook);
                                        if (bookmaker) {
                                            const outcome = bookmaker.markets.find(market => market.key === 'h2h').outcomes;
                                            const lowerImpliedProbOutcome = outcome.find(o => (
                                                ((game.predictedWinner === 'home' ? Math.abs(game.homeTeamIndex - game.awayTeamIndex) : Math.abs(game.awayTeamIndex - game.homeTeamIndex)) > (indexDifSmall) &&
                                                    (game.predictedWinner === 'home' ? Math.abs(game.homeTeamIndex - game.awayTeamIndex) : Math.abs(game.awayTeamIndex - game.homeTeamIndex)) < (indexDifSmall + indexDiffRange)) &&
                                                (game.predictionStrength > confidenceLow && game.predictionStrength < (confidenceLow + confidenceRange)) &&
                                                (o.impliedProb * 100) < (game.winPercent + winPercentInc) &&
                                                ((game.predictedWinner === 'home' && game.home_team === o.name) || (game.predictedWinner === 'away' && game.away_team === o.name))
                                            ));
                                            return lowerImpliedProbOutcome !== undefined;
                                        }
                                        return false;
                                    });

                                    if (totalGames.length > 10) {
                                        let correctGames = totalGames.filter((game) => game.predictionCorrect === true);
                                        let winRate = correctGames.length / totalGames.length;
                                        if (winRate > finalWinrate) {
                                            finalWinrate = winRate;
                                            finalTotalGames = totalGames.length
                                            finalSettings = {
                                                winPercentIncrease: winPercentInc,
                                                indexDiffSmallNum: indexDifSmall,
                                                indexDiffRangeNum: indexDiffRange,
                                                confidenceLowNum: confidenceLow,
                                                confidenceRangeNum: confidenceRange
                                            };
                                            console.log('Sport', sport.name);
                                            console.log('Sportsbook: ', sportsbook);
                                            console.log('Best Winrate: ', finalWinrate);
                                            console.log('Best Winrate numbers: ', `${correctGames.length}/${totalGames.length}`);
                                            console.log('Best Settings: ', finalSettings);
                                        } else if (winRate === finalWinrate && totalGames.length > finalTotalGames) {
                                            finalWinrate = winRate;
                                            finalTotalGames = totalGames.length
                                            finalSettings = {
                                                winPercentIncrease: winPercentInc,
                                                indexDiffSmallNum: indexDifSmall,
                                                indexDiffRangeNum: indexDiffRange,
                                                confidenceLowNum: confidenceLow,
                                                confidenceRangeNum: confidenceRange
                                            };
                                            console.log('Sport', sport.name);
                                            console.log('Sportsbook: ', sportsbook);
                                            console.log('Best Winrate: ', finalWinrate);
                                            console.log('Best Winrate numbers: ', `${correctGames.length}/${totalGames.length}`);
                                            console.log('Best Settings: ', finalSettings);

                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                console.log('Sport', sport.name);
                console.log('Sportsbook: ', sportsbook);
                console.log('Best Winrate: ', finalWinrate);
                console.log('Best Settings: ', finalSettings);

                if (!fs.existsSync(`./valueBetTesting/${sport.name}`)) {
                    console.log('Creating model directory...');
                    fs.mkdirSync(`./valueBetTesting/${sport.name}`, { recursive: true });
                }
                fs.writeFileSync(`./valueBetTesting/${sport.name}/${sportsbook}-bestSettings.json`, JSON.stringify(finalSettings), (err) => {
                    if (err) {
                        console.error("Error writing file:", err);
                    } else {
                        console.log('Data written to file');
                    }
                });

            }));
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

        if (sport.multiYear
            && ((currentMonth >= sport.startMonth && currentMonth <= 12) || (currentMonth >= 1 && currentMonth <= sport.endMonth))
            || !sport.multiYear
            && (currentMonth >= sport.startMonth && currentMonth <= sport.endMonth)) {

            let sportGames = usableGames.filter((game) => game.sport_key === sport.name);


            if (sportGames.length > 0) {
                for (const sportsbook of sportsbooks) {
                    let storeCI = sport.valueBetSettings?.sportsbook?.settings.bestConfidenceInterval ||  { lower: 0, upper: 0 }
                    
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
                                    ((game.predictedWinner === 'home' ? Math.abs(game.homeTeamIndex - game.awayTeamIndex) : Math.abs(game.awayTeamIndex - game.homeTeamIndex)) > (indexDifSmall) &&
                                        (game.predictedWinner === 'home' ? Math.abs(game.homeTeamIndex - game.awayTeamIndex) : Math.abs(game.awayTeamIndex - game.homeTeamIndex)) < (indexDifSmall + indexDiffRange)) &&
                                    (game.predictionStrength > confidenceLow && game.predictionStrength < (confidenceLow + confidenceRange)) &&
                                    // (o.impliedProb * 100) < (game.winPercent + winPercentInc) &&
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
                                newCI.upper > storeCI.upper                            // Ensure the new CI's upper bound is better
                            ) {
                                storeCI = newCI
                                finalWinrate = winRate;
                                finalTotalGames = totalGames.length;
                                finalSettings.settings = {
                                    // winPercentIncrease: winPercentInc,
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

        console.log(`FINISHED VALUE BET SEARCH for ${sport.name} @ ${moment().format('HH:mm:ss')}`)
    }
    console.log(`FINISHED VALUE BET SEARCH @ ${moment().format('HH:mm:ss')}`)

};



module.exports = { valueBetRandomSearch, hyperparameterRandSearch }