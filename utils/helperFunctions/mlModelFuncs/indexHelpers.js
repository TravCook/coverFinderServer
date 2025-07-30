const moment = require('moment')
const { Odds, PastGameOdds, Sport, Weights } = require('../../../models');
const db = require('../../../models_sql');
const { normalizeStat, predictions } = require('./trainingHelpers')
const cliProgress = require('cli-progress');
const Sequelize = require('sequelize');
const { baseballStatMap, basketballStatMap, footballStatMap, hockeyStatMap } = require('../../statMaps');
const { Op } = Sequelize;

// Calculate mean
function mean(scores) {
    return scores.reduce((sum, val) => sum + val, 0) / scores.length;
}

// Calculate standard deviation
function stdDev(scores) {
    const avg = mean(scores);
    const squareDiffs = scores.map(val => Math.pow(val - avg, 2));
    const avgSquareDiff = mean(squareDiffs);
    return Math.sqrt(avgSquareDiff);
}

// Z-score normalization
function zScore(score, mean, std) {
    return (score - mean) / std;
}

function scaleZTo045(z, minZ, maxZ, scaleMin = 0, scaleMax = 45) {
    let scaled = ((z - minZ) / (maxZ - minZ)) * (scaleMax - scaleMin) + scaleMin;
    if (scaled > scaleMax) scaled = scaleMax;
    if (scaled < scaleMin) scaled = scaleMin;
    return scaled;
}

const getNumericStat = (stats, statName) => {
    if (!stats || stats[statName] === undefined) return 0;

    if (statName === 'seasonWinLoss') {
        const [wins, losses] = stats[statName].split("-").map(Number);
        return wins - losses;
    }

    if (statName === 'homeWinLoss' || statName === 'awayWinLoss') {
        const [wins, losses] = stats[statName].split("-").map(Number);
        return wins - losses;
    }

    return stats[statName];
};

function calculateTeamIndex(teamStats, weightArray, statMap, normalizeStatFn) {
    let index = 0;
    let weightIndex = 0;
    for (const statName of statMap) {
        let rawValue = getNumericStat(teamStats, statName)
        let weight = weightArray.find((weight) => weight.feature === statName);
        if (typeof rawValue === 'number' && !isNaN(rawValue)) {
            const normalizedValue = normalizeStatFn(statName, rawValue);
            index += normalizedValue * weight.importance;
        } else {
            console.warn(`Stat missing or invalid: ${statName}`);
        }
        // console.log(`Stat: ${statName}, Raw Value: ${rawValue}, Normalized Value: ${normalizeStatFn(statName, rawValue)}, Weight: ${weight.importance}, Current Index: ${index}`);
        weightIndex++;
    }

    return index;
}


const calculateWinrate = (games, sport, homeTeam, awayTeam, homeTeamScaledIndex, awayTeamScaledIndex, predictedWinner, predictionConfidence, date) => {

    // Step 1: Filter games where predictions have been made
    const usableGames = games.filter((game) => new Date(game.commence_time) < new Date(date));
    // Step 2: Filter games that match the sport league
    const leagueGames = usableGames.filter(leagueGame => leagueGame.sport_key === sport.name);
    // Step 3: Filter games where the home_team matches the team
    const homeTeamGames = usableGames.filter(homeTeamGame => homeTeamGame['homeTeamDetails.espnDisplayName'] === homeTeam || homeTeamGame['awayTeamDetails.espnDisplayName'] === homeTeam);
    // Step 4: Filter games where the away_team matches the team
    const awayTeamGames = usableGames.filter(awayTeamGame => awayTeamGame['homeTeamDetails.espnDisplayName'] === awayTeam || awayTeamGame['awayTeamDetails.espnDisplayName'] === awayTeam);
    //game with the same index diff
    const indexDifGames = usableGames.filter(game => (game.predictedWinner === 'home' ? game.homeTeamScaledIndex - game.awayTeamScaledIndex : game.awayTeamScaledIndex - game.homeTeamScaledIndex) < (predictedWinner === 'home' ? homeTeamScaledIndex - awayTeamScaledIndex : awayTeamScaledIndex - homeTeamScaledIndex) + 5 || (game.predictedWinner === 'home' ? game.homeTeamScaledIndex - game.awayTeamScaledIndex : game.awayTeamScaledIndex - game.homeTeamScaledIndex) > (predictedWinner === 'home' ? homeTeamScaledIndex - awayTeamScaledIndex : awayTeamScaledIndex - homeTeamScaledIndex) - 5)
    //games with same confidenceRating
    const confidenceRateGames = usableGames.filter(game => (game.predictionConfidence > predictionConfidence - .1) || (game.predictionConfidence < predictionConfidence + .1))

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


const getTeamsIndexes = async (sport) => {
    let sportTeams = await db.Teams.findAll({ where: { league: sport.name } })
    let plainTeams = sportTeams.map((team) => team.get({ plain: true }))
    const indexArray = plainTeams
        .flatMap(team => {
            const home = Number(team.statIndex);
            return [home].filter(i => !isNaN(i));
        })
        .sort((a, b) => a - b);
    return indexArray
}


const indexAdjuster = async (currentOdds, initalsport, allPastGames, weightArray, past) => {
    console.log(`STARTING INDEXING FOR ${initalsport.name} @ ${moment().format('HH:mm:ss')}`);
    const baseIndexBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    if (past) {
        currentOdds = currentOdds.filter((game) => game.sport_key === initalsport.name && game.complete === true)
        allPastGames = allPastGames.filter((game) => game.sport_key === initalsport.name && game.complete === true && game.predictedWinner === 'home' || game.predictedWinner === 'away');
    }
    let total = currentOdds.length
    let sport = await db.Sports.findOne({ where: { name: initalsport.name }, raw: true });
    baseIndexBar.start(total, 0);
    let progress = 0
    for (const game of currentOdds) {
        // Check if the game is in the future
        if (moment().isBefore(moment(game.commence_time)) || past === true) {
            let homeIndex = 0;
            let awayIndex = 0;
            const statMap = {
                'americanfootball_nfl': footballStatMap,
                'americanfootball_ncaaf': footballStatMap,
                'icehockey_nhl': hockeyStatMap,
                'basketball_nba': basketballStatMap,
                'baseball_mlb': baseballStatMap,
                'basketball_ncaab': basketballStatMap,
                'basketball_wncaab': basketballStatMap,
            };
            homeIndex = await calculateTeamIndex(game['homeStats.data'], weightArray, statMap[initalsport.name], normalizeStat);
            awayIndex = await calculateTeamIndex(game['awayStats.data'], weightArray, statMap[initalsport.name], normalizeStat);

            await db.Games.update({
                homeTeamIndex: homeIndex,
                awayTeamIndex: awayIndex,
            }, {
                where: { id: game.id }
            }).catch(err => {
                console.error(`Error updating game ${game.id}:`, err);
            })
        }
        progress += 1;
        baseIndexBar.update(progress)
        if (progress >= total) {
            baseIndexBar.stop();
        }
    }

    if (past) {
        currentOdds = await db.Games.findAll({
            where: {
                sport_key: initalsport.name,
                predictedWinner: { [Op.in]: ['home', 'away'] },  // ✅ matches only 'home' or 'away',
                complete: true,
            },
            include: [
                {
                    model: db.Teams,
                    as: 'homeTeamDetails',

                },
                {
                    model: db.Teams,
                    as: 'awayTeamDetails',

                }
            ],

            raw: true,
        })
    } else {
        currentOdds = await db.Games.findAll({
            where: {
                sport_key: initalsport.name,
                predictedWinner: { [Op.in]: ['home', 'away'] },  // ✅ matches only 'home' or 'away',
                complete: false,
            },
            include: [
                {
                    model: db.Teams,
                    as: 'homeTeamDetails',

                },
                {
                    model: db.Teams,
                    as: 'awayTeamDetails',

                }
            ],
            raw: true,
        })
    }
    const normalizedIndexBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    normalizedIndexBar.start(currentOdds.length, 0);
    let outliers = 0
    let Zoutliers = 0
    for (const game of currentOdds) {
        if (moment().isBefore(moment(game.commence_time)) || past === true) {
            let indexArray
            if (past) {
                const gameIndex = currentOdds.findIndex(searchGame => searchGame.id === game.id);

                // Guard against not finding the game
                if (gameIndex === -1) {
                    console.error("Game not found in currentOdds");
                } else {
                    const start = Math.max(0, gameIndex - 15);
                    const end = Math.min(currentOdds.length, gameIndex + 16); // +16 because slice is exclusive

                    indexArray = currentOdds.sort((gameA,gameB) => new Date(gameA.commence_time) - new Date(gameB.commence_time)).slice(start, end).flatMap(mapGame => {
                        const home = Number(mapGame.homeTeamIndex);
                        const away = Number(mapGame.awayTeamIndex);
                        return [home, away].filter(i => !isNaN(i));
                    }).sort((a, b) => a - b);
                }
            } else {
                indexArray = await getTeamsIndexes(initalsport)
            }
            const avg = mean(indexArray);
            // console.log(`Home Index: ${game.homeTeamIndex}, Away Index: ${game.awayTeamIndex} for game ID: ${game.id}`);
            // console.log(`${game['homeTeamDetails.espnDisplayName']}: ${game.homeTeamScaledIndex}, ${game['awayTeamDetails.espnDisplayName']}: ${game.awayTeamScaledIndex} for game ID: ${game.id}`)
            // console.log(avg)
            const std = stdDev(indexArray);
            const homeZ = zScore(game.homeTeamIndex, avg, std);
            const awayZ = zScore(game.awayTeamIndex, avg, std);
            const scaledHomeZ = scaleZTo045(homeZ, -3, 3, 0, 45);
            const scaledAwayZ = scaleZTo045(awayZ, -3, 3, 0, 45);
            if (scaledHomeZ > 45 || scaledAwayZ > 45 || scaledHomeZ < 0 || scaledAwayZ < 0) {
                Zoutliers++
            }
            // console.log(`${game['homeTeamDetails.espnDisplayName']}: ${scaledHomeZ}, ${game['awayTeamDetails.espnDisplayName']}: ${scaledAwayZ} for game ID: ${game.id}`)

            // Update the Odds database with the calculated indices
            const winrate = await calculateWinrate(allPastGames, sport, game['homeTeamDetails.espnDisplayName'], game['awayTeamDetails.espnDisplayName'], scaledHomeZ, scaledAwayZ, game.predictedWinner, game.predictionConfidence, game.commence_time);
            if (sport.name === game.sport_key) {
                try {
                    await db.Games.update({
                        homeTeamScaledIndex: scaledHomeZ,
                        awayTeamScaledIndex: scaledAwayZ,
                        winPercent: winrate,
                    }, {
                        where: { id: game.id }
                    });
                } catch (err) {
                    console.log(game.commence_time)
                    console.log('normalizedHomeIndex', normalizedHomeIndex)
                    console.log('normalizedAwayIndex', normalizedAwayIndex)
                }
            }
        }
        normalizedIndexBar.increment();
        if (normalizedIndexBar.value >= normalizedIndexBar.getTotal()) {
            normalizedIndexBar.stop();
        }
    }
    console.log(`Outliers found: ${outliers} for ${initalsport.name} out of ${currentOdds.length} games.`)
    console.log(`Z-Score Outliers found: ${Zoutliers} for ${initalsport.name} out of ${currentOdds.length} games.`)
    if (global.gc) global.gc();
    console.log(`FINSHED INDEXING FOR ${initalsport.name} @ ${moment().format('HH:mm:ss')}`);
}

const pastGamesReIndex = async (sportGames, sport) => {

    if (sportGames.length > 0) {
        console.log(`STARTING PAST GAMES INDEXING FOR ${sport.name} @ ${moment().format('HH:mm:ss')}`);
        await indexAdjuster(sportGames, sport, sportGames, sport['MlModelWeights.featureImportanceScores'], true)
        console.log(`FINISHED PAST GAMES INDEXING FOR ${sport.name} @ ${moment().format('HH:mm:ss')}`);

    }


}

module.exports = { indexAdjuster, pastGamesReIndex, calculateTeamIndex }