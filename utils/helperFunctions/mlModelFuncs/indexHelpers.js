const moment = require('moment')
const { Odds, PastGameOdds, Sport, Weights } = require('../../../models');
const { normalizeStat } = require('./trainingHelpers')

//DETERMINE H2H INDEXES FOR EVERY GAME IN ODDS
// Helper function to adjust indexes for football games
const adjustnflStats = (homeTeam, awayTeam, homeIndex, awayIndex, weightArray) => {
    homeIndex += (normalizeStat('seasonWinLoss', homeTeam.seasonWinLoss.split("-")[0]) - normalizeStat('seasonWinLoss', awayTeam.seasonWinLoss.split("-")[0])) * weightArray[0];
    awayIndex += (normalizeStat('seasonWinLoss', awayTeam.seasonWinLoss.split("-")[0]) - normalizeStat('seasonWinLoss', homeTeam.seasonWinLoss.split("-")[0])) * weightArray[0]
    homeIndex += (normalizeStat('homeWinLoss', homeTeam.homeWinLoss.split("-")[0]) - normalizeStat('awayWinLoss', awayTeam.awayWinLoss.split("-")[0])) * weightArray[1];
    awayIndex += (normalizeStat('awayWinLoss', awayTeam.homeWinLoss.split("-")[0]) - normalizeStat('homeWinLoss', homeTeam.awayWinLoss.split("-")[0])) * weightArray[1]
    homeIndex += (normalizeStat('pointDiff', homeTeam.pointDiff) - normalizeStat('pointDiff', awayTeam.pointDiff)) * weightArray[2];
    awayIndex += (normalizeStat('pointDiff', awayTeam.pointDiff) - normalizeStat('pointDiff', homeTeam.pointDiff)) * weightArray[2];
    let nflWeightIndex = 3
    const reverseComparisonStats = ['BSKBturnoversPerGame', 'BSKBfoulsPerGame', 'BKSBturnoverRatio'];

    for (const stat in homeTeam.stats) {
        if (homeTeam.stats.hasOwnProperty(stat)) {
            const homeStat = homeTeam.stats[stat];
            const awayStat = awayTeam.stats[stat];

            // Check if the stat is one that requires reve
            // For reversed comparison, check if homeStat is less than or equal to awayStat
            if ((typeof homeStat === 'number' && !isNaN(homeStat)) && (typeof awayStat === 'number' && !isNaN(awayStat))) {

                homeIndex += (normalizeStat(stat, homeStat) - normalizeStat(stat, awayStat)) * weightArray[nflWeightIndex];

                awayIndex += (normalizeStat(stat, awayStat) - normalizeStat(stat, homeStat)) * weightArray[nflWeightIndex];

                nflWeightIndex++
            }

            // For all other stats, check if homeStat is greater than or equal to awayStat

        }
    }




    return { homeIndex, awayIndex };
}

const adjustncaafStats = (homeTeam, awayTeam, homeIndex, awayIndex, weightArray) => {
    homeIndex += (normalizeStat('seasonWinLoss', homeTeam.seasonWinLoss.split("-")[0]) - normalizeStat('seasonWinLoss', awayTeam.seasonWinLoss.split("-")[0])) * weightArray[0];
    awayIndex += (normalizeStat('seasonWinLoss', awayTeam.seasonWinLoss.split("-")[0]) - normalizeStat('seasonWinLoss', homeTeam.seasonWinLoss.split("-")[0])) * weightArray[0]
    homeIndex += (normalizeStat('homeWinLoss', homeTeam.homeWinLoss.split("-")[0]) - normalizeStat('awayWinLoss', awayTeam.awayWinLoss.split("-")[0])) * weightArray[1];
    awayIndex += (normalizeStat('awayWinLoss', awayTeam.homeWinLoss.split("-")[0]) - normalizeStat('homeWinLoss', homeTeam.awayWinLoss.split("-")[0])) * weightArray[1]
    homeIndex += (normalizeStat('pointDiff', homeTeam.pointDiff) - normalizeStat('pointDiff', awayTeam.pointDiff)) * weightArray[2];
    awayIndex += (normalizeStat('pointDiff', awayTeam.pointDiff) - normalizeStat('pointDiff', homeTeam.pointDiff)) * weightArray[2];
    let ncaafWeightIndex = 3
    const reverseComparisonStats = ['BSKBturnoversPerGame', 'BSKBfoulsPerGame', 'BKSBturnoverRatio'];

    for (const stat in homeTeam.stats) {
        if (homeTeam.stats.hasOwnProperty(stat)) {
            const homeStat = homeTeam.stats[stat];
            const awayStat = awayTeam.stats[stat];

            // Check if the stat is one that requires reve
            // For reversed comparison, check if homeStat is less than or equal to awayStat
            if ((typeof homeStat === 'number' && !isNaN(homeStat)) && (typeof awayStat === 'number' && !isNaN(awayStat))) {

                homeIndex += (normalizeStat(stat, homeStat) - normalizeStat(stat, awayStat)) * weightArray[ncaafWeightIndex];

                awayIndex += (normalizeStat(stat, awayStat) - normalizeStat(stat, homeStat)) * weightArray[ncaafWeightIndex];

                ncaafWeightIndex++
            }

            // For all other stats, check if homeStat is greater than or equal to awayStat

        }
    }




    return { homeIndex, awayIndex };
}

// Helper function to adjust indexes for hockey games
const adjustnhlStats = (homeTeam, awayTeam, homeIndex, awayIndex, weightArray) => {
    homeIndex += (normalizeStat('seasonWinLoss', homeTeam.seasonWinLoss.split("-")[0]) - normalizeStat('seasonWinLoss', awayTeam.seasonWinLoss.split("-")[0])) * weightArray[0];
    awayIndex += (normalizeStat('seasonWinLoss', awayTeam.seasonWinLoss.split("-")[0]) - normalizeStat('seasonWinLoss', homeTeam.seasonWinLoss.split("-")[0])) * weightArray[0]
    homeIndex += (normalizeStat('homeWinLoss', homeTeam.homeWinLoss.split("-")[0]) - normalizeStat('awayWinLoss', awayTeam.awayWinLoss.split("-")[0])) * weightArray[1];
    awayIndex += (normalizeStat('awayWinLoss', awayTeam.homeWinLoss.split("-")[0]) - normalizeStat('homeWinLoss', homeTeam.awayWinLoss.split("-")[0])) * weightArray[1]
    homeIndex += (normalizeStat('pointDiff', homeTeam.pointDiff) - normalizeStat('pointDiff', awayTeam.pointDiff)) * weightArray[2];
    awayIndex += (normalizeStat('pointDiff', awayTeam.pointDiff) - normalizeStat('pointDiff', homeTeam.pointDiff)) * weightArray[2];
    let nhlWeightIndex = 3
    const reverseComparisonStats = ['BSKBturnoversPerGame', 'BSKBfoulsPerGame', 'BKSBturnoverRatio'];

    for (const stat in homeTeam.stats) {
        if (homeTeam.stats.hasOwnProperty(stat)) {
            const homeStat = homeTeam.stats[stat];
            const awayStat = awayTeam.stats[stat];

            // Check if the stat is one that requires reve
            // For reversed comparison, check if homeStat is less than or equal to awayStat
            if ((typeof homeStat === 'number' && !isNaN(homeStat)) && (typeof awayStat === 'number' && !isNaN(awayStat))) {

                homeIndex += (normalizeStat(stat, homeStat) - normalizeStat(stat, awayStat)) * weightArray[nhlWeightIndex];

                awayIndex += (normalizeStat(stat, awayStat) - normalizeStat(stat, homeStat)) * weightArray[nhlWeightIndex];

                nhlWeightIndex++
            }

            // For all other stats, check if homeStat is greater than or equal to awayStat

        }
    }




    return { homeIndex, awayIndex };
}

// Helper function to adjust indexes for basketball games TODO: CHANGE OTHER SPORTS TO NORMALIZE STATS AND MULTIPLE BY FEATURE IMPORTANCE
const adjustnbaStats = (homeTeam, awayTeam, homeIndex, awayIndex, weightArray) => {
    homeIndex += (normalizeStat('seasonWinLoss', homeTeam.seasonWinLoss.split("-")[0]) - normalizeStat('seasonWinLoss', awayTeam.seasonWinLoss.split("-")[0])) * weightArray[0];
    awayIndex += (normalizeStat('seasonWinLoss', awayTeam.seasonWinLoss.split("-")[0]) - normalizeStat('seasonWinLoss', homeTeam.seasonWinLoss.split("-")[0])) * weightArray[0]
    homeIndex += (normalizeStat('homeWinLoss', homeTeam.homeWinLoss.split("-")[0]) - normalizeStat('awayWinLoss', awayTeam.awayWinLoss.split("-")[0])) * weightArray[1];
    awayIndex += (normalizeStat('awayWinLoss', awayTeam.homeWinLoss.split("-")[0]) - normalizeStat('homeWinLoss', homeTeam.awayWinLoss.split("-")[0])) * weightArray[1]
    homeIndex += (normalizeStat('pointDiff', homeTeam.pointDiff) - normalizeStat('pointDiff', awayTeam.pointDiff)) * weightArray[2];
    awayIndex += (normalizeStat('pointDiff', awayTeam.pointDiff) - normalizeStat('pointDiff', homeTeam.pointDiff)) * weightArray[2];
    let nbaWeightIndex = 3
    const reverseComparisonStats = ['BSKBturnoversPerGame', 'BSKBfoulsPerGame', 'BKSBturnoverRatio'];

    for (const stat in homeTeam.stats) {
        if (homeTeam.stats.hasOwnProperty(stat)) {
            const homeStat = homeTeam.stats[stat];
            const awayStat = awayTeam.stats[stat];

            // Check if the stat is one that requires reve
            // For reversed comparison, check if homeStat is less than or equal to awayStat
            if ((typeof homeStat === 'number' && !isNaN(homeStat)) && (typeof awayStat === 'number' && !isNaN(awayStat))) {

                homeIndex += (normalizeStat(stat, homeStat) - normalizeStat(stat, awayStat)) * weightArray[nbaWeightIndex];

                awayIndex += (normalizeStat(stat, awayStat) - normalizeStat(stat, homeStat)) * weightArray[nbaWeightIndex];

                nbaWeightIndex++
            }

            // For all other stats, check if homeStat is greater than or equal to awayStat

        }
    }




    return { homeIndex, awayIndex };
}
// Helper function to adjust indexes for baseball games
const adjustmlbStats = (homeTeam, awayTeam, homeIndex, awayIndex, weightArray) => {
    homeIndex += (normalizeStat('seasonWinLoss', homeTeam.seasonWinLoss.split("-")[0]) - normalizeStat('seasonWinLoss', awayTeam.seasonWinLoss.split("-")[0])) * weightArray[0];
    awayIndex += (normalizeStat('seasonWinLoss', awayTeam.seasonWinLoss.split("-")[0]) - normalizeStat('seasonWinLoss', homeTeam.seasonWinLoss.split("-")[0])) * weightArray[0]
    homeIndex += (normalizeStat('homeWinLoss', homeTeam.homeWinLoss.split("-")[0]) - normalizeStat('awayWinLoss', awayTeam.awayWinLoss.split("-")[0])) * weightArray[1];
    awayIndex += (normalizeStat('awayWinLoss', awayTeam.homeWinLoss.split("-")[0]) - normalizeStat('homeWinLoss', homeTeam.awayWinLoss.split("-")[0])) * weightArray[1]
    homeIndex += (normalizeStat('pointDiff', homeTeam.pointDiff) - normalizeStat('pointDiff', awayTeam.pointDiff)) * weightArray[2];
    awayIndex += (normalizeStat('pointDiff', awayTeam.pointDiff) - normalizeStat('pointDiff', homeTeam.pointDiff)) * weightArray[2];
    let mlbWeightIndex = 3
    const reverseComparisonStats = ['BSKBturnoversPerGame', 'BSKBfoulsPerGame', 'BKSBturnoverRatio'];

    for (const stat in homeTeam.stats) {
        if (homeTeam.stats.hasOwnProperty(stat)) {
            const homeStat = homeTeam.stats[stat];
            const awayStat = awayTeam.stats[stat];

            // Check if the stat is one that requires reve
            // For reversed comparison, check if homeStat is less than or equal to awayStat
            if ((typeof homeStat === 'number' && !isNaN(homeStat)) && (typeof awayStat === 'number' && !isNaN(awayStat))) {

                homeIndex += (normalizeStat(stat, homeStat) - normalizeStat(stat, awayStat)) * weightArray[mlbWeightIndex];

                awayIndex += (normalizeStat(stat, awayStat) - normalizeStat(stat, homeStat)) * weightArray[mlbWeightIndex];

                mlbWeightIndex++
            }

            // For all other stats, check if homeStat is greater than or equal to awayStat

        }
    }




    return { homeIndex, awayIndex };
}

const adjustncaamStats = (homeTeam, awayTeam, homeIndex, awayIndex, weightArray) => {
    homeIndex += (normalizeStat('seasonWinLoss', homeTeam.seasonWinLoss.split("-")[0]) - normalizeStat('seasonWinLoss', awayTeam.seasonWinLoss.split("-")[0])) * weightArray[0];
    awayIndex += (normalizeStat('seasonWinLoss', awayTeam.seasonWinLoss.split("-")[0]) - normalizeStat('seasonWinLoss', homeTeam.seasonWinLoss.split("-")[0])) * weightArray[0]
    homeIndex += (normalizeStat('homeWinLoss', homeTeam.homeWinLoss.split("-")[0]) - normalizeStat('awayWinLoss', awayTeam.awayWinLoss.split("-")[0])) * weightArray[1];
    awayIndex += (normalizeStat('awayWinLoss', awayTeam.homeWinLoss.split("-")[0]) - normalizeStat('homeWinLoss', homeTeam.awayWinLoss.split("-")[0])) * weightArray[1]
    homeIndex += (normalizeStat('pointDiff', homeTeam.pointDiff) - normalizeStat('pointDiff', awayTeam.pointDiff)) * weightArray[2];
    awayIndex += (normalizeStat('pointDiff', awayTeam.pointDiff) - normalizeStat('pointDiff', homeTeam.pointDiff)) * weightArray[2];
    let ncaamWeightIndex = 3
    const reverseComparisonStats = ['BSKBturnoversPerGame', 'BSKBfoulsPerGame', 'BKSBturnoverRatio'];

    for (const stat in homeTeam.stats) {
        if (homeTeam.stats.hasOwnProperty(stat)) {
            const homeStat = homeTeam.stats[stat];
            const awayStat = awayTeam.stats[stat];

            // Check if the stat is one that requires reve
            // For reversed comparison, check if homeStat is less than or equal to awayStat
            if ((typeof homeStat === 'number' && !isNaN(homeStat)) && (typeof awayStat === 'number' && !isNaN(awayStat))) {

                homeIndex += (normalizeStat(stat, homeStat) - normalizeStat(stat, awayStat)) * weightArray[ncaamWeightIndex];

                awayIndex += (normalizeStat(stat, awayStat) - normalizeStat(stat, homeStat)) * weightArray[ncaamWeightIndex];

                ncaamWeightIndex++
            }

            // For all other stats, check if homeStat is greater than or equal to awayStat

        }
    }




    return { homeIndex, awayIndex };
}

const adjustwncaabStats = (homeTeam, awayTeam, homeIndex, awayIndex, weightArray) => {
    homeIndex += (normalizeStat('seasonWinLoss', homeTeam.seasonWinLoss.split("-")[0]) - normalizeStat('seasonWinLoss', awayTeam.seasonWinLoss.split("-")[0])) * weightArray[0];
    awayIndex += (normalizeStat('seasonWinLoss', awayTeam.seasonWinLoss.split("-")[0]) - normalizeStat('seasonWinLoss', homeTeam.seasonWinLoss.split("-")[0])) * weightArray[0]
    homeIndex += (normalizeStat('homeWinLoss', homeTeam.homeWinLoss.split("-")[0]) - normalizeStat('awayWinLoss', awayTeam.awayWinLoss.split("-")[0])) * weightArray[1];
    awayIndex += (normalizeStat('awayWinLoss', awayTeam.homeWinLoss.split("-")[0]) - normalizeStat('homeWinLoss', homeTeam.awayWinLoss.split("-")[0])) * weightArray[1]
    homeIndex += (normalizeStat('pointDiff', homeTeam.pointDiff) - normalizeStat('pointDiff', awayTeam.pointDiff)) * weightArray[2];
    awayIndex += (normalizeStat('pointDiff', awayTeam.pointDiff) - normalizeStat('pointDiff', homeTeam.pointDiff)) * weightArray[2];
    let wncaabWeightIndex = 3
    const reverseComparisonStats = ['BSKBturnoversPerGame', 'BSKBfoulsPerGame', 'BKSBturnoverRatio'];

    for (const stat in homeTeam.stats) {
        if (homeTeam.stats.hasOwnProperty(stat)) {
            const homeStat = homeTeam.stats[stat];
            const awayStat = awayTeam.stats[stat];

            // Check if the stat is one that requires reve
            // For reversed comparison, check if homeStat is less than or equal to awayStat
            if ((typeof homeStat === 'number' && !isNaN(homeStat)) && (typeof awayStat === 'number' && !isNaN(awayStat))) {

                homeIndex += (normalizeStat(stat, homeStat) - normalizeStat(stat, awayStat)) * weightArray[wncaabWeightIndex];

                awayIndex += (normalizeStat(stat, awayStat) - normalizeStat(stat, homeStat)) * weightArray[wncaabWeightIndex];

                wncaabWeightIndex++
            }

            // For all other stats, check if homeStat is greater than or equal to awayStat

        }
    }




    return { homeIndex, awayIndex };
}

const calculateWinrate = (games, sport, homeTeam, awayTeam, homeTeamIndex, awayTeamIndex, predictedWinner, predictionStrength) => {

    // Step 1: Filter games where predictionCorrect is true
    const usableGames = games.filter(usableGame => usableGame.predictedWinner);
    // Step 2: Filter games that match the sport league
    const leagueGames = usableGames.filter(leagueGame => leagueGame.sport_key === sport.name);
    // Step 3: Filter games where the home_team matches the team
    const homeTeamGames = usableGames.filter(homeTeamGame => homeTeamGame.home_team === homeTeam || homeTeamGame.away_team === homeTeam);
    // Step 4: Filter games where the away_team matches the team
    const awayTeamGames = usableGames.filter(awayTeamGame => awayTeamGame.home_team === awayTeam || awayTeamGame.away_team === awayTeam);
    //game with the same index diff
    const indexDifGames = usableGames.filter(game => (game.predictedWinner === 'home' ? game.homeTeamIndex - game.awayTeamIndex : game.awayTeamIndex - game.homeTeamIndex) < (predictedWinner === 'home' ? homeTeamIndex - awayTeamIndex : awayTeamIndex - homeTeamIndex) + 5 || (game.predictedWinner === 'home' ? game.homeTeamIndex - game.awayTeamIndex : game.awayTeamIndex - game.homeTeamIndex) > (predictedWinner === 'home' ? homeTeamIndex - awayTeamIndex : awayTeamIndex - homeTeamIndex) - 5)
    //games with same confidenceRating
    const confidenceRateGames = usableGames.filter(game => (game.predictionStrength > predictionStrength - 5) || (game.predictionStrength < predictionStrength + 5))

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

    // Return both individual winrates, and weighted average
    return average
}

function sigmoidNormalize(value, midpoint, sharpness) {
    const sigmoid = 1 / (1 + Math.exp(-sharpness * (value - midpoint)));
    return sigmoid * 45; // map to 0–45 for HSL
}

function calculateIQRSharpness(indexes) {
    const sorted = indexes.slice().sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;

    if (iqr === 0) return 1; // prevent divide-by-zero, fallback value

    const sharpness = Math.log(9) / iqr;
    return sharpness;
}

const indexAdjuster = async (currentOdds, initalsport, allPastGames, weightArray, past) => {
    console.log(`STARTING INDEXING FOR ${initalsport.name} @ ${moment().format('HH:mm:ss')}`);
    const currentDate = new Date();
    const oneYearAgo = new Date(currentDate);
    oneYearAgo.setDate(currentDate.getDate() - 365); // Subtract 365 days
    oneYearAgo.setHours(0, 0, 0, 0);  // Set time to midnight
    let sport = await Sport.findOne({ name: initalsport.name })
    let updates = [];
    for (const game of currentOdds) {
        // Check if the game is in the future
        if (moment().isBefore(moment(game.commence_time)) || past === true) {
            let homeIndex = 0;
            let awayIndex = 0;
            const adjustFunctions = {
                'americanfootball_nfl': adjustnflStats,
                'americanfootball_ncaaf': adjustncaafStats,
                'icehockey_nhl': adjustnhlStats,
                'basketball_nba': adjustnbaStats,
                'baseball_mlb': adjustmlbStats,
                'basketball_ncaab': adjustncaamStats,
                'basketball_wncaab': adjustwncaabStats,
            };
            if (game.homeTeamStats && game.awayTeamStats) {
                const adjustFn = adjustFunctions[game.sport_key];
                if (adjustFn) {
                    ({ homeIndex, awayIndex } = await adjustFn(
                        game.homeTeamStats,
                        game.awayTeamStats,
                        homeIndex,
                        awayIndex,
                        weightArray
                    ));
                }
            }
            const winrate = await calculateWinrate(allPastGames, sport, game.home_team, game.away_team, game.homeTeamScaledIndex, game.awayTeamScaledIndex, game.predictedWinner, game.predictionStrength);
            // Update the Odds database with the calculated indices
            if (sport.name === game.sport_key) {
                if (past === true) {
                    try {
                        updates.push({
                            updateOne: {
                                filter: { id: game.id },
                                update: {
                                    $set: {
                                        homeTeamIndex: homeIndex,
                                        awayTeamIndex: awayIndex,
                                        winPercent: winrate
                                    }
                                }
                            }
                        });
                    } catch (err) {
                        console.log(game.commence_time)
                        console.log('homeIndex', homeIndex)
                        console.log('awayIndex', awayIndex)
                    }
                } else {
                    try {
                        updates.push({
                            updateOne: {
                                filter: { id: game.id },
                                update: {
                                    $set: {
                                        homeTeamIndex: homeIndex,
                                        awayTeamIndex: awayIndex,
                                        winPercent: winrate
                                    }
                                }
                            }
                        });
                    } catch (err) {
                        console.log(game.commence_time)
                        console.log('homeIndex', homeIndex)
                        console.log('awayIndex', awayIndex)
                    }
                }
            }
        }
    }
    if(past === true){
        await PastGameOdds.bulkWrite(updates);
    }else{
        await Odds.bulkWrite(updates);
    }
    currentOdds = null
    console.log('Base indexes found and applied')
    let avgIndex = await PastGameOdds.aggregate([
        { $match: { sport_key: sport.name, commence_time: { $gte: oneYearAgo } } },
        { $project: { indexes: ["$homeTeamIndex", "$awayTeamIndex"] } },
        { $unwind: "$indexes" },
        { $group: { _id: null, avgIndex: { $avg: "$indexes" } } }
    ])
    let interquartileRange = await PastGameOdds.aggregate([
        { $match: { sport_key: sport.name, commence_time: { $gte: oneYearAgo } } },
        { $project: { indexes: ["$homeTeamIndex", "$awayTeamIndex"] } },
        { $unwind: "$indexes" },
        { $sort: { indexes: 1 } },
        { $group: { _id: null, indexArray: { $push: "$indexes" } } }
    ])

    if (past === true) {
        currentOdds = await PastGameOdds.find({ sport_key: sport.name }).sort({ commence_time: 1 })
    } else {
        currentOdds = await Odds.find({ sport_key: sport.name }).sort({ commence_time: 1 })
    }
    updates = []
    for (const game of currentOdds) {
        if (moment().isBefore(moment(game.commence_time)) || past === true) {


            let normalizedHomeIndex = sigmoidNormalize(game.homeTeamIndex, avgIndex[0].avgIndex, calculateIQRSharpness(interquartileRange[0].indexArray))
            let normalizedAwayIndex = sigmoidNormalize(game.awayTeamIndex, avgIndex[0].avgIndex, calculateIQRSharpness(interquartileRange[0].indexArray))
            // Update the Odds database with the calculated indices
            if (sport.name === game.sport_key) {
                if (past === true) {
                    try {
                        updates.push({
                            updateOne: {
                                filter: { id: game.id },
                                update: {
                                    $set: {
                                        homeTeamScaledIndex: normalizedHomeIndex,
                                        awayTeamScaledIndex: normalizedAwayIndex,
                                    }
                                }
                            }
                        });
                    } catch (err) {
                        // console.log(err)
                        console.log(game.commence_time)
                        console.log('normalizedHomeIndex', normalizedHomeIndex)
                        console.log('normalizedAwayIndex', normalizedAwayIndex)
                    }
                } else {
                    try {
                        updates.push({
                            updateOne: {
                                filter: { id: game.id },
                                update: {
                                    $set: {
                                        homeTeamScaledIndex: normalizedHomeIndex,
                                        awayTeamScaledIndex: normalizedAwayIndex,
                                    }
                                }
                            }
                        });

                    } catch (err) {
                        console.log(game.commence_time)
                        console.log('normalizedHomeIndex', normalizedHomeIndex)
                        console.log('normalizedAwayIndex', normalizedAwayIndex)
                    }
                }


            }
        }
    }
    if(past === true){
        await PastGameOdds.bulkWrite(updates);
    }else{
        await Odds.bulkWrite(updates);
    }
    updates = []
    extremes = null
    console.log('Normalized indexes found and applied')
    console.log(`FINSHED INDEXING FOR ${initalsport.name} @ ${moment().format('HH:mm:ss')}`);
}

const extractSportWeights = async (model, sportName) => {
    let weights, weightMatrix, averages = [];

    // Extract weights from the first (input) layer of the model
    weights = model.layers[0].getWeights();
    weightMatrix = await weights[0].array(); // This gives the matrix of weights for each feature

    // Sum weights for each feature (column-wise)
    matrixIterator(weightMatrix, averages);

    // Return the averages array specific to the sport
    return averages;
}
const matrixIterator = (weightMatrix, averages) => {
    for (let i = 0; i < weightMatrix.length; i++) {
        let row = weightMatrix[i];
        // Calculate the sum of the 64 weights in the row
        let sum = row.reduce((acc, value) => acc + value, 0);

        // Calculate the average of the row
        let average = Math.abs(sum / row.length);

        // Store the average in the averages array
        averages.push(average * 10);  // Optional: Multiply for better scaling
    }
}
const handleSportWeights = async (model, sport) => {
    let sportWeights;

    switch (sport.name) {
        case 'americanfootball_nfl':
            sportWeights = await extractSportWeights(model, 'americanfootball_nfl');
            weightArray = sportWeights;
            break;

        case 'americanfootball_ncaaf':
            sportWeights = await extractSportWeights(model, 'americanfootball_ncaaf');
            ncaafWeights = sportWeights;
            break;

        case 'basketball_nba':
            sportWeights = await extractSportWeights(model, 'basketball_nba');
            nbaWeights = sportWeights;
            break;

        case 'baseball_mlb':
            sportWeights = await extractSportWeights(model, 'baseball_mlb');
            mlbWeights = sportWeights;
            break;

        case 'icehockey_nhl':
            sportWeights = await extractSportWeights(model, 'icehockey_nhl');
            nhlWeights = sportWeights;
            break;

        case 'basketball_ncaab':
            sportWeights = await extractSportWeights(model, 'basketball_ncaab');
            ncaamWeights = sportWeights;
            break;

        case 'basketball_wncaab':
            sportWeights = await extractSportWeights(model, 'basketball_wncaab');
            ncaawWeights = sportWeights;
            break;

        default:
            console.log(`No weight extraction logic for sport: ${sport.name}`);
    }
}

const pastGamesReIndex = async () => {

    const sports = await Sport.find({})
    for (const sport of sports) {
        const sportGames = await Odds.find(({ sport_key: sport.name }))
        if (sportGames.length > 0) {

            let pastGames = await PastGameOdds.find({ sport_key: sport.name }).sort({ commence_time: 1 })
            const sportWeightDB = await Weights.findOne({ league: sport.name })
            let weightArray = sportWeightDB?.featureImportanceScores
            await indexAdjuster(pastGames, sport, pastGames, weightArray, true)
            pastGames = []

        }


    }

}

module.exports = { adjustnflStats, adjustncaafStats, adjustnhlStats, adjustnbaStats, adjustmlbStats, adjustncaamStats, adjustwncaabStats, indexAdjuster, extractSportWeights, matrixIterator, handleSportWeights, pastGamesReIndex }