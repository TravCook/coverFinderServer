// TODO: STORE FOR LATER
const { Odds, PastGameOdds, UsaFootballTeam, BasketballTeam, BaseballTeam, HockeyTeam, Sport, Weights } = require('../../../models');
const { extractSportFeatures, loadOrCreateModel } = require('../mlModelFuncs/trainingHelpers.js')
const tf = require('@tensorflow/tfjs-node');


const pastGamesRePredict = async () => {
    let allSports = await Sport.find()
    allSports.forEach(async (sport) => {
        if (sport.name != 'americanfootball_ncaaf') {
            let pastGames = await PastGameOdds.find({
                sport_key: sport.name,
                commence_time: { $gte: '2025-01-14T00:40:00Z' }
            });

            // Define the path to the model
            const modelPath = `./model_checkpoint/${sport.name}_model/model.json`;
            // Define the path to the model directory
            const modelDir = `./model_checkpoint/${sport.name}_model`;


            
            // console.log(model)
            // model.compile({
            //     optimizer: tf.train.adam(.0001),
            //     loss: 'binaryCrossentropy',
            //     metrics: ['accuracy']
            // });
            // // Train the model
            // await model.fit(xsTensor, ysTensor, {
            //     epochs: 100,
            //     batchSize: 64,
            //     validationSplit: 0.3,

            //     verbose: false
            // });
            //TODO LOAD ML CHECKPOINT FOR SPORT
            //TODO RUN PAST GAMES FOR SPORT THROUGH PREDICTION, CHANGING THE VALUE OF PREDICTED WINNER TO THE NEW PREDICTION
            let ff = []
            if (pastGames.length > 0) {
                // Step 1: Extract the features for each game
                for (const game of pastGames) {
                    if (game.homeTeamStats && game.awayTeamStats) {
                        const homeStats = game.homeTeamStats;
                        const awayStats = game.awayTeamStats;

                        // Extract features based on sport
                        const features = extractSportFeatures(homeStats, awayStats, game.sport_key);
                        ff.push(features);  // Add the features for each game
                    }
                }
                const model = await loadOrCreateModel(ff, sport)
                // Step 2: Create a Tensor for the features array
                const ffTensor = tf.tensor2d(ff);

                const logits = model.predict(ffTensor, { training: false }); // logits without sigmoid

                // Step 3: Get the predictions
                const predictions = await model.predict(ffTensor, { training: false });

                // Step 4: Convert predictions tensor to array
                const probabilities = await predictions.array();  // Resolves to an array
                console.log(probabilities)

                // Step 5: Loop through each game and update with predicted probabilities
                for (let index = 0; index < pastGames.length; index++) {
                    const game = pastGames[index];
                    if (game.homeTeamStats && game.awayTeamStats) {
                        const predictedWinPercent = probabilities[index][0]; // Probability for the home team win

                        // Make sure to handle NaN values safely
                        const predictionStrength = Number.isNaN(predictedWinPercent) ? 0 : predictedWinPercent;

                        // Step 6: Determine the predicted winner
                        const predictedWinner = predictedWinPercent >= 0.5 ? 'home' : 'away';
                        try {
                            // Update the game with prediction strength
                            await PastGameOdds.findOneAndUpdate(
                                { id: game.id },
                                {
                                    predictionStrength: predictionStrength > .50 ? predictionStrength : 1 - predictionStrength,
                                    predictedWinner: predictedWinner,
                                    predictionCorrect: game.winner === predictedWinner ? true : false
                                }
                            );
                        } catch (err) {
                            console.log(err)
                        }

                    }
                }
            }
        }

    })


}

// TODO: FINISH WORKING ON THIS TO RECALCULATE THE WINRATE OF PAST GAMES
const pastGameWinPercent = async () => {
    let pastGames = await PastGameOdds.find({
        predictedWinner: { $in: ['home', 'away'] }
    });

    for (const game of pastGames) {
        // Step 1: Filter games where predictionCorrect is true
        const usableGames = pastGames.filter((pastGame) => new Date(pastGame.commence_time) < new Date(game.commence_time))
        // Step 2: Filter games that match the sport league
        const leagueGames = usableGames.filter(leagueGame => leagueGame.sport_key === game.sport_key);
        // Step 3: Filter games where the home_team matches the team
        const homeTeamGames = usableGames.filter(homeTeamGame => homeTeamGame.home_team === game.homeTeam || homeTeamGame.away_team === game.homeTeam);
        // Step 4: Filter games where the away_team matches the team
        const awayTeamGames = usableGames.filter(awayTeamGame => awayTeamGame.home_team === game.awayTeam || awayTeamGame.away_team === game.awayTeam);
        //game with the same index diff
        const indexDifGames = usableGames.filter(indexGame => (indexGame.predictedWinner === 'home' ? indexGame.homeTeamIndex - indexGame.awayTeamIndex : indexGame.awayTeamIndex - indexGame.homeTeamIndex) < (game.predictedWinner === 'home' ? game.homeTeamIndex - game.awayTeamIndex : game.awayTeamIndex - game.homeTeamIndex) + 5 || (indexGame.predictedWinner === 'home' ? indexGame.homeTeamIndex - indexGame.awayTeamIndex : indexGame.awayTeamIndex - indexGame.homeTeamIndex) > (game.predictedWinner === 'home' ? game.homeTeamIndex - game.awayTeamIndex : game.awayTeamIndex - game.homeTeamIndex) - 5)
        //games with same confidenceRating
        const confidenceRateGames = usableGames.filter(confGame => (confGame.predictionStrength > game.predictionStrength - 5) || (confGame.predictionStrength < game.predictionStrength + 5))

        // Step 5: Calculate winrate for each scenario
        const totalGames = usableGames.length;
        const totalPredictionCorrect = usableGames.filter(correctGame => correctGame.predictionCorrect === true).length;
        const totalLeagueGames = leagueGames.length;
        const totalHomeTeamGames = homeTeamGames.length;
        const totalAwayTeamGames = awayTeamGames.length;
        const totalindexDifGames = indexDifGames.length
        const totalConfidenceGames = confidenceRateGames.length

        // Function to calculate winrate percentage
        const calculatePercentage = (part, total) => total > 0 ? (part / total) * 100 : 0;

        const allPredictionCorrect = calculatePercentage(totalPredictionCorrect, totalGames);
        const leaguePredictionCorrect = calculatePercentage(leagueGames.filter(leagueCorrectGame => leagueCorrectGame.predictionCorrect === true).length, totalLeagueGames);
        const homeTeamPredictionCorrect = calculatePercentage(homeTeamGames.filter(game => game.predictionCorrect === true).length, totalHomeTeamGames);
        const awayTeamPredictionCorrect = calculatePercentage(awayTeamGames.filter(game => game.predictionCorrect === true).length, totalAwayTeamGames);
        // Calculate the winrate for index differences (the percentage of games where the predicted winner had a larger index difference)
        const indexDiffPredictionCorrect = calculatePercentage(
            indexDifGames.filter(game => game.predictionCorrect === true).length,
            totalindexDifGames
        );

        const confidencePredictionCorrect = calculatePercentage(confidenceRateGames.filter(game => game.predictionCorrect === true), totalConfidenceGames)
        // Step 6: Calculate the weighted winrate for regular categories
        const weightedWinrate = {};

        if (!(Number.isNaN(allPredictionCorrect))) {
            weightedWinrate.allPredictionCorrect = allPredictionCorrect;
        }

        if (!(Number.isNaN(leaguePredictionCorrect))) {
            weightedWinrate.leaguePredictionCorrect = leaguePredictionCorrect;
        }

        if (!(Number.isNaN(homeTeamPredictionCorrect))) {
            weightedWinrate.homeTeamPredictionCorrect = homeTeamPredictionCorrect;
        }

        if (!(Number.isNaN(awayTeamPredictionCorrect))) {
            weightedWinrate.awayTeamPredictionCorrect = awayTeamPredictionCorrect;
        }

        if (!(Number.isNaN(indexDiffPredictionCorrect))) {
            weightedWinrate.indexDiffPredictionCorrect = indexDiffPredictionCorrect;
        }

        if (!(Number.isNaN(confidencePredictionCorrect))) {
            weightedWinrate.confidencePredictionCorrect = confidencePredictionCorrect;
        }


        // Extract the values from the object
        const values = Object.values(weightedWinrate);

        // Calculate the sum of the values
        const sum = values.reduce((acc, val) => acc + val, 0);

        // Calculate the average by dividing the sum by the number of keys
        const average = sum / values.length;

        try {
            // Return both individual winrates, and weighted average
            await PastGameOdds.findOneAndUpdate({ id: game.id }, {
                ...game,
                winPercent: average
            })
        } catch (err) {
            console.log(err)
        }


    }
    console.log('DONE')
}

module.exports = { pastGamesRePredict }