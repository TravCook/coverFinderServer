const moment = require('moment')
const { Odds, PastGameOdds, UsaFootballTeam, BasketballTeam, BaseballTeam, HockeyTeam, Sport, Weights } = require('../../../models');
const { normalizeStat } = require('./trainingHelpers')

let nflWeights = []
let nbaWeights = []
let mlbWeights = []
let nhlWeights = []
let ncaafWeights = []
let ncaamWeights = []
let ncaawWeights = []

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

const indexAdjuster = async (currentOdds, sport, allPastGames, weightArray, past) => {
    console.log(`STARTING INDEXING FOR ${sport.name} @ ${moment().format('HH:mm:ss')}`);


    for (const game of currentOdds) {
        let maxGame = await PastGameOdds.aggregate([
            {
                $match: {
                    sport_key: sport.name,
                    commence_time: { $lte: game.commence_time },
                    homeTeamIndex: { $ne: null }, // Ensure homeTeamIndex is not null
                    awayTeamIndex: { $ne: null }  // Ensure awayTeamIndex is not null
                }
            }, // filter by sport
            {
                $project: {
                    sport_key: 1,
                    homeTeamIndex: 1,
                    awayTeamIndex: 1,
                    highestIndex: { $max: ['$homeTeamIndex', '$awayTeamIndex'] }, // calculate the max of homeIndex and awayIndex
                },
            },
            { $sort: { commence_time: -1 } }, // Sort by date to ensure most recent games come first
            { $limit: sport.indexGames }, // Limit to the last 15 games
            { $sort: { highestIndex: -1 } }, // sort by the highest index
            // { $limit: 1 }, // limit to just one result
        ]).exec()
        let minGame = await PastGameOdds.aggregate([
            {
                $match: {
                    sport_key: sport.name,
                    commence_time: { $lte: game.commence_time },
                    homeTeamIndex: { $ne: null }, // Ensure homeTeamIndex is not null
                    awayTeamIndex: { $ne: null }  // Ensure awayTeamIndex is not null
                }
            }, // filter by sport
            {
                $project: {
                    sport_key: 1,
                    homeTeamIndex: 1,
                    awayTeamIndex: 1,
                    lowestIndex: { $min: ['$homeTeamIndex', '$awayTeamIndex'] }, // calculate the min of homeIndex and awayIndex
                },
            },
            { $sort: { commence_time: -1 } }, // Sort by date to ensure most recent games come first
            { $limit: sport.indexGames }, // Limit to the last 15 games
            { $sort: { lowestIndex: 1 } }, // sort by the highest index
            // { $limit: 1 }, // limit to just one result
        ]).exec()
        if (!maxGame || maxGame.length === 0) {
            // If no result for maxGame (edge case), fallback to the first 10 games
            maxGame = await PastGameOdds.aggregate([
                {
                    $match: {
                        sport_key: sport.name,
                    }
                }, // filter by sport
                {
                    $project: {
                        sport_key: 1,
                        homeTeamIndex: 1,
                        awayTeamIndex: 1,
                        highestIndex: { $max: ['$homeTeamIndex', '$awayTeamIndex'] }, // calculate the max of homeIndex and awayIndex
                    },
                },
                { $sort: { commence_time: -1 } }, // Sort by date to ensure most recent games come first
                { $limit: sport.indexGames }, // Limit to the last 15 games
                { $sort: { highestIndex: -1 } }, // sort by the highest index
                { $limit: 1 }, // limit to just one result
            ]).exec();
        }
        if (!minGame || minGame.length === 0) {
            // If no result for minGame (edge case), fallback to the first 10 games
            minGame = await PastGameOdds.aggregate([
                {
                    $match: {
                        sport_key: sport.name,
                    }
                }, // filter by sport
                {
                    $project: {
                        sport_key: 1,
                        homeTeamIndex: 1,
                        awayTeamIndex: 1,
                        lowestIndex: { $min: ['$homeTeamIndex', '$awayTeamIndex'] }, // calculate the min of homeIndex and awayIndex
                    },
                },
                { $sort: { commence_time: -1 } }, // Sort by date to ensure most recent games come first
                { $limit: sport.indexGames }, // Limit to the last 15 games
                { $sort: { lowestIndex: -1 } }, // sort by the highest index
                { $limit: 1 }, // limit to just one result
            ]).exec();
        }
        let indexMin = minGame[0].lowestIndex
        let indexMax = maxGame[0].highestIndex
        // Check if the game is in the future
        if (moment().isBefore(moment(game.commence_time)) || past === true) {

            let homeTeam;
            let awayTeam;

            // Fetch team data based on sport
            if (game.sport === 'football') {
                if (game.sport_key === 'americanfootball_nfl') {
                    homeTeam = await UsaFootballTeam.findOne({
                        'sport_key': 'americanfootball_nfl',
                        'espnDisplayName': game.home_team
                    });
                    awayTeam = await UsaFootballTeam.findOne({
                        'sport_key': 'americanfootball_nfl',
                        'espnDisplayName': game.away_team
                    });
                } else if (game.sport_key === 'americanfootball_ncaaf') {
                    homeTeam = await UsaFootballTeam.findOne({
                        'sport_key': 'americanfootball_ncaaf',
                        'espnDisplayName': game.home_team
                    });
                    awayTeam = await UsaFootballTeam.findOne({
                        'sport_key': 'americanfootball_ncaaf',
                        'espnDisplayName': game.away_team
                    });
                }
                homeTeam = await UsaFootballTeam.findOne({ 'espnDisplayName': game.home_team });
                awayTeam = await UsaFootballTeam.findOne({ 'espnDisplayName': game.away_team });
            } else if (game.sport === 'baseball') {
                homeTeam = await BaseballTeam.findOne({ 'espnDisplayName': game.home_team });
                awayTeam = await BaseballTeam.findOne({ 'espnDisplayName': game.away_team });
            } else if (game.sport === 'basketball') {
                if (game.sport_key === 'basketball_nba') {
                    homeTeam = await BasketballTeam.findOne({
                        'league': 'nba',
                        'espnDisplayName': game.home_team
                    });
                    awayTeam = await BasketballTeam.findOne({
                        'league': 'nba',
                        'espnDisplayName': game.away_team
                    });
                } else if (game.sport_key === 'basketball_ncaab') {
                    homeTeam = await BasketballTeam.findOne({
                        'league': 'mens-college-basketball',
                        'espnDisplayName': game.home_team
                    });
                    awayTeam = await BasketballTeam.findOne({
                        'league': 'mens-college-basketball',
                        'espnDisplayName': game.away_team
                    });
                } else if (game.sport_key === 'basketball_wncaab') {
                    homeTeam = await BasketballTeam.findOne({
                        'league': 'womens-college-basketball',
                        'espnDisplayName': game.home_team
                    });
                    awayTeam = await BasketballTeam.findOne({
                        'league': 'womens-college-basketball',
                        'espnDisplayName': game.away_team
                    });
                }
            } else if (game.sport === 'hockey') {
                homeTeam = await HockeyTeam.findOne({ 'espnDisplayName': game.home_team });
                awayTeam = await HockeyTeam.findOne({ 'espnDisplayName': game.away_team });
            }


            let homeIndex = 0;
            let awayIndex = 0;

            if (homeTeam && awayTeam && homeTeam.stats && awayTeam.stats && homeTeam.seasonWinLoss && awayTeam.seasonWinLoss) {
                // Sport-specific conditions
                if (game.sport_key === 'americanfootball_nfl') {
                    ({ homeIndex, awayIndex } = await adjustnflStats(homeTeam, awayTeam, homeIndex, awayIndex, weightArray));
                }
                else if (game.sport_key === 'americanfootball_ncaaf') {
                    ({ homeIndex, awayIndex } = await adjustncaafStats(homeTeam, awayTeam, homeIndex, awayIndex, weightArray));
                }
                else if (game.sport_key === 'icehockey_nhl') {
                    ({ homeIndex, awayIndex } = await adjustnhlStats(homeTeam, awayTeam, homeIndex, awayIndex, weightArray));
                }
                else if (game.sport_key === 'basketball_nba') {
                    ({ homeIndex, awayIndex } = await adjustnbaStats(homeTeam, awayTeam, homeIndex, awayIndex, weightArray));
                }
                else if (game.sport_key === 'baseball_mlb') {
                    ({ homeIndex, awayIndex } = await adjustmlbStats(homeTeam, awayTeam, homeIndex, awayIndex, weightArray));
                }
                else if (game.sport_key === 'basketball_ncaab') {
                    ({ homeIndex, awayIndex } = await adjustncaamStats(homeTeam, awayTeam, homeIndex, awayIndex, weightArray));

                }
                else if (game.sport_key === 'basketball_wncaab') {
                    ({ homeIndex, awayIndex } = await adjustwncaabStats(homeTeam, awayTeam, homeIndex, awayIndex, weightArray));
                }
            }
            const getCommonStats = (team) => ({
                //------------------------------SHARED STATS-----------------------------------------------------------
                seasonWinLoss: team.seasonWinLoss,
                homeWinLoss: team.homeWinLoss,
                awayWinLoss: team.awayWinLoss,
                pointDiff: team.pointDiff,

                USFBcompletionPercent: team.stats.USFBcompletionPercent,
                USFBcompletions: team.stats.USFBcompletions,
                USFBcompletionsPerGame: team.stats.USFBcompletionsPerGame,
                USFBnetPassingYards: team.stats.USFBnetPassingYards,
                USFBnetPassingYardsPerGame: team.stats.USFBnetPassingYardsPerGame,
                USFBpassingFirstDowns: team.stats.USFBpassingFirstDowns,
                USFBpassingTouchdowns: team.stats.USFBpassingTouchdowns,
                USFBpassingYards: team.stats.USFBpassingYards,
                USFBpassingYardsPerGame: team.stats.USFBpassingYardsPerGame,
                USFBpassingAttempts: team.stats.USFBpassingAttempts,
                USFBpassingAttemptsPerGame: team.stats.USFBpassingAttemptsPerGame,
                USFByardsPerPassAttempt: team.stats.USFByardsPerPassAttempt,
                USFBrushingAttempts: team.stats.USFBrushingAttempts,
                USFBrushingFirstDowns: team.stats.USFBrushingFirstDowns,
                USFBrushingTouchdowns: team.stats.USFBrushingTouchdowns,
                USFBrushingYards: team.stats.USFBrushingYards,
                USFBrushingYardsPerGame: team.stats.USFBrushingYardsPerGame,
                USFByardsPerRushAttempt: team.stats.USFByardsPerRushAttempt,
                USFBreceivingFirstDowns: team.stats.USFBreceivingFirstDowns,
                USFBreceivingTouchdowns: team.stats.USFBreceivingTouchdowns,
                USFBreceivingYards: team.stats.USFBreceivingYards,
                USFBreceivingYardsPerGame: team.stats.USFBreceivingYardsPerGame,
                USFBreceivingYardsPerReception: team.stats.USFBreceivingYardsPerReception,
                USFBreceivingYardsAfterCatch: team.stats.USFBreceivingYardsAfterCatch,
                USFBreceivingYardsAfterCatchPerGame: team.stats.USFBreceivingYardsAfterCatchPerGame,
                USFBtotalTouchdowns: team.stats.USFBtotalTouchdowns,
                USFBtouchdownsPerGame: team.stats.USFBtouchdownsPerGame,
                USFBtotalPoints: team.stats.USFBtotalPoints,
                USFBpointsPerGame: team.stats.USFBpointsPerGame,
                USFBtacklesforLoss: team.stats.USFBtacklesforLoss,
                USFBtacklesforLossPerGame: team.stats.USFBtacklesforLossPerGame,
                USFBinterceptions: team.stats.USFBinterceptions,
                USFByardsPerInterception: team.stats.USFByardsPerInterception,
                USFBsacksTotal: team.stats.USFBsacksTotal,
                USFBsacksPerGame: team.stats.USFBsacksPerGame,
                USFBsackYards: team.stats.USFBsackYards,
                USFBsackYardsPerGame: team.stats.USFBsackYardsPerGame,
                USFBstuffs: team.stats.USFBstuffs,
                USFBstuffsPerGame: team.stats.USFBstuffsPerGame,
                USFBstuffYards: team.stats.USFBstuffYards,
                USFBpassesDefended: team.stats.USFBpassesDefended,
                USFBpassesDefendedPerGame: team.stats.USFBpassesDefendedPerGame,
                USFBsafties: team.stats.USFBsafties,
                USFBaverageKickoffYards: team.stats.USFBaverageKickoffYards,
                USFBaverageKickoffYardsPerGame: team.stats.USFBaverageKickoffYardsPerGame,
                USFBextraPointAttempts: team.stats.USFBextraPointAttempts,
                USFBextraPointAttemptsPerGame: team.stats.USFBextraPointAttemptsPerGame,
                USFBextraPointsMade: team.stats.USFBextraPointsMade,
                USFBextraPointsMadePerGame: team.stats.USFBextraPointsMadePerGame,
                USFBextraPointPercent: team.stats.USFBextraPointPercent,
                USFBextraPointPercentPerGame: team.stats.USFBextraPointPercentPerGame,
                USFBfieldGoalAttempts: team.stats.USFBfieldGoalAttempts,
                USFBfieldGoalAttemptsPerGame: team.stats.USFBfieldGoalAttemptsPerGame,
                USFBfieldGoalsMade: team.stats.USFBfieldGoalsMade,
                USFBfieldGoalsMadePerGame: team.stats.USFBfieldGoalsMadePerGame,
                USFBfieldGoalPct: team.stats.USFBfieldGoalPct,
                USFBfieldGoalPercentPerGame: team.stats.USFBfieldGoalPercentPerGame,
                USFBtouchbacks: team.stats.USFBtouchbacks,
                USFBtouchbacksPerGame: team.stats.USFBtouchbacksPerGame,
                USFBtouchBackPercentage: team.stats.USFBtouchBackPercentage,
                USFBkickReturns: team.stats.USFBkickReturns,
                USFBkickReturnsPerGame: team.stats.USFBkickReturnsPerGame,
                USFBkickReturnYards: team.stats.USFBkickReturnYards,
                USFBkickReturnYardsPerGame: team.stats.USFBkickReturnYardsPerGame,
                USFBpuntReturns: team.stats.USFBpuntReturns,
                USFBpuntReturnsPerGame: team.stats.USFBpuntReturnsPerGame,
                USFBpuntReturnFairCatchPct: team.stats.USFBpuntReturnFairCatchPct,
                USFBpuntReturnYards: team.stats.USFBpuntReturnYards,
                USFBpuntReturnYardsPerGame: team.stats.USFBpuntReturnYardsPerGame,
                USFByardsPerReturn: team.stats.USFByardsPerReturn,
                USFBthirdDownEfficiency: team.stats.USFBthirdDownEfficiency,
                USFBtotalPenyards: team.stats.USFBtotalPenyards,
                USFBaveragePenYardsPerGame: team.stats.USFBaveragePenYardsPerGame,
                USFBgiveaways: team.stats.USFBgiveaways,
                USFBtakeaways: team.stats.USFBtakeaways,
                USFBturnoverDiff: team.stats.USFBturnoverDiff,
                USFBtotalFirstDowns: team.stats.USFBtotalFirstDowns,

                //------------------------------AMERICAN FOOTBALL STATS-----------------------------------------------------------
                BSBbattingStrikeouts: team.stats.BSBbattingStrikeouts,
                BSBrunsBattedIn: team.stats.BSBrunsBattedIn,
                BSBsacrificeHits: team.stats.BSBsacrificeHits,
                BSBHitsTotal: team.stats.BSBHitsTotal,
                BSBwalks: team.stats.BSBwalks,
                BSBruns: team.stats.BSBruns,
                BSBhomeRuns: team.stats.BSBhomeRuns,
                BSBdoubles: team.stats.BSBdoubles,
                BSBtotalBases: team.stats.BSBtotalBases,
                BSBextraBaseHits: team.stats.BSBextraBaseHits,
                BSBbattingAverage: team.stats.BSBbattingAverage,
                BSBsluggingPercentage: team.stats.BSBsluggingPercentage,
                BSBonBasePercentage: team.stats.BSBonBasePercentage,
                BSBonBasePlusSlugging: team.stats.BSBonBasePlusSlugging,
                BSBgroundToFlyRatio: team.stats.BSBgroundToFlyRatio,
                BSBatBatsPerHomeRun: team.stats.BSBatBatsPerHomeRun,
                BSBstolenBasePercentage: team.stats.BSBstolenBasePercentage,
                BSBbatterWalkToStrikeoutRatio: team.stats.BSBbatterWalkToStrikeoutRatio,
                BSBsaves: team.stats.BSBsaves,
                BSBpitcherStrikeouts: team.stats.BSBpitcherStrikeouts,
                BSBhitsGivenUp: team.stats.BSBhitsGivenUp,
                BSBearnedRuns: team.stats.BSBearnedRuns,
                BSBbattersWalked: team.stats.BSBbattersWalked,
                BSBrunsAllowed: team.stats.BSBrunsAllowed,
                BSBhomeRunsAllowed: team.stats.BSBhomeRunsAllowed,
                BSBwins: team.stats.BSBwins,
                BSBshutouts: team.stats.BSBshutouts,
                BSBearnedRunAverage: team.stats.BSBearnedRunAverage,
                BSBwalksHitsPerInningPitched: team.stats.BSBwalksHitsPerInningPitched,
                BSBwinPct: team.stats.BSBwinPct,
                BSBpitcherCaughtStealingPct: team.stats.BSBpitcherCaughtStealingPct,
                BSBpitchesPerInning: team.stats.BSBpitchesPerInning,
                BSBrunSupportAverage: team.stats.BSBrunSupportAverage,
                BSBopponentBattingAverage: team.stats.BSBopponentBattingAverage,
                BSBopponentSlugAverage: team.stats.BSBopponentSlugAverage,
                BSBopponentOnBasePct: team.stats.BSBopponentOnBasePct,
                BSBopponentOnBasePlusSlugging: team.stats.BSBopponentOnBasePlusSlugging,
                BSBsavePct: team.stats.BSBsavePct,
                BSBstrikeoutsPerNine: team.stats.BSBstrikeoutsPerNine,
                BSBpitcherStrikeoutToWalkRatio: team.stats.BSBpitcherStrikeoutToWalkRatio,
                BSBdoublePlays: team.stats.BSBdoublePlays,
                BSBerrors: team.stats.BSBerrors,
                BSBpassedBalls: team.stats.BSBpassedBalls,
                BSBassists: team.stats.BSBassists,
                BSBputouts: team.stats.BSBputouts,
                BSBcatcherCaughtStealing: team.stats.BSBcatcherCaughtStealing,
                BSBcatcherCaughtStealingPct: team.stats.BSBcatcherCaughtStealingPct,
                BSBcatcherStolenBasesAllowed: team.stats.BSBcatcherStolenBasesAllowed,
                BSBfieldingPercentage: team.stats.BSBfieldingPercentage,
                BSBrangeFactor: team.stats.BSBrangeFactor,

                //------------------------------BASKETBALL STATS-----------------------------------------------------------
                BSKBtotalPoints: team.stats.BSKBtotalPoints,
                BSKBpointsPerGame: team.stats.BSKBpointsPerGame,
                BSKBassists: team.stats.BSKBassists,
                BSKBassistsPerGame: team.stats.BSKBassistsPerGame,
                BSKBassistRatio: team.stats.BSKBassistRatio,
                BSKBeffectiveFgPercent: team.stats.BSKBeffectiveFgPercent,
                BSKBfieldGoalPercent: team.stats.BSKBfieldGoalPercent,
                BSKBfieldGoalsAttempted: team.stats.BSKBfieldGoalsAttempted,
                BSKBfieldGoalsMade: team.stats.BSKBfieldGoalsMade,
                BSKBfieldGoalsPerGame: team.stats.BSKBfieldGoalsPerGame,
                BSKBfreeThrowPercent: team.stats.BSKBfreeThrowPercent,
                BSKBfreeThrowsAttempted: team.stats.BSKBfreeThrowsAttempted,
                BSKBfreeThrowsMade: team.stats.BSKBfreeThrowsMade,
                BSKBfreeThrowsMadePerGame: team.stats.BSKBfreeThrowsMadePerGame,
                BSKBoffensiveRebounds: team.stats.BSKBoffensiveRebounds,
                BSKBoffensiveReboundsPerGame: team.stats.BSKBoffensiveReboundsPerGame,
                BSKBoffensiveReboundRate: team.stats.BSKBoffensiveReboundRate,
                BSKBoffensiveTurnovers: team.stats.BSKBoffensiveTurnovers,
                BSKBturnoversPerGame: team.stats.BSKBturnoversPerGame,
                BSKBturnoverRatio: team.stats.BSKBturnoverRatio,
                BSKBthreePointPct: team.stats.BSKBthreePointPct,
                BSKBthreePointsAttempted: team.stats.BSKBthreePointsAttempted,
                BSKBthreePointsMade: team.stats.BSKBthreePointsMade,
                BSKBtrueShootingPct: team.stats.BSKBtrueShootingPct,
                BSKBpace: team.stats.BSKBpace,
                BSKBpointsInPaint: team.stats.BSKBpointsInPaint,
                BSKBshootingEfficiency: team.stats.BSKBshootingEfficiency,
                BSKBscoringEfficiency: team.stats.BSKBscoringEfficiency,
                BSKBblocks: team.stats.BSKBblocks,
                BSKBblocksPerGame: team.stats.BSKBblocksPerGame,
                BSKBdefensiveRebounds: team.stats.BSKBdefensiveRebounds,
                BSKBdefensiveReboundsPerGame: team.stats.BSKBdefensiveReboundsPerGame,
                BSKBsteals: team.stats.BSKBsteals,
                BSKBstealsPerGame: team.stats.BSKBstealsPerGame,
                BSKBreboundRate: team.stats.BSKBreboundRate,
                BSKBreboundsPerGame: team.stats.BSKBreboundsPerGame,
                BSKBfoulsPerGame: team.stats.BSKBfoulsPerGame,
                BSKBteamAssistToTurnoverRatio: team.stats.BSKBteamAssistToTurnoverRatio,

                //------------------------------HOCKEY STATS-----------------------------------------------------------
                HKYgoals: team.stats.HKYgoals,
                HKYgoalsPerGame: team.stats.HKYgoalsPerGame,
                HKYassists: team.stats.HKYassists,
                HKYassistsPerGame: team.stats.HKYassistsPerGame,
                HKYshotsIn1st: team.stats.HKYshotsIn1st,
                HKYshotsIn1stPerGame: team.stats.HKYshotsIn1stPerGame,
                HKYshotsIn2nd: team.stats.HKYshotsIn2nd,
                HKYshotsIn2ndPerGame: team.stats.HKYshotsIn2ndPerGame,
                HKYshotsIn3rd: team.stats.HKYshotsIn3rd,
                HKYshotsIn3rdPerGame: team.stats.HKYshotsIn3rdPerGame,
                HKYtotalShots: team.stats.HKYtotalShots,
                HKYtotalShotsPerGame: team.stats.HKYtotalShotsPerGame,
                HKYshotsMissed: team.stats.HKYshotsMissed,
                HKYshotsMissedPerGame: team.stats.HKYshotsMissedPerGame,
                HKYppgGoals: team.stats.HKYppgGoals,
                HKYppgGoalsPerGame: team.stats.HKYppgGoalsPerGame,
                HKYppassists: team.stats.HKYppassists,
                HKYppassistsPerGame: team.stats.HKYppassistsPerGame,
                HKYpowerplayPct: team.stats.HKYpowerplayPct,
                HKYshortHandedGoals: team.stats.HKYshortHandedGoals,
                HKYshortHandedGoalsPerGame: team.stats.HKYshortHandedGoalsPerGame,
                HKYshootingPct: team.stats.HKYshootingPct,
                HKYfaceoffs: team.stats.HKYfaceoffs,
                HKYfaceoffsPerGame: team.stats.HKYfaceoffsPerGame,
                HKYfaceoffsWon: team.stats.HKYfaceoffsWon,
                HKYfaceoffsWonPerGame: team.stats.HKYfaceoffsWonPerGame,
                HKYfaceoffsLost: team.stats.HKYfaceoffsLost,
                HKYfaceoffsLostPerGame: team.stats.HKYfaceoffsLostPerGame,
                HKYfaceoffPct: team.stats.HKYfaceoffPct,
                HKYfaceoffPctPerGame: team.stats.HKYfaceoffPctPerGame,
                HKYgiveaways: team.stats.HKYgiveaways,
                HKYgoalsAgainst: team.stats.HKYgoalsAgainst,
                HKYgoalsAgainstPerGame: team.stats.HKYgoalsAgainstPerGame,
                HKYshotsAgainst: team.stats.HKYshotsAgainst,
                HKYshotsAgainstPerGame: team.stats.HKYshotsAgainstPerGame,
                HKYpenaltyKillPct: team.stats.HKYpenaltyKillPct,
                HKYpenaltyKillPctPerGame: team.stats.HKYpenaltyKillPctPerGame,
                HKYppGoalsAgainst: team.stats.HKYppGoalsAgainst,
                HKYppGoalsAgainstPerGame: team.stats.HKYppGoalsAgainstPerGame,
                HKYshutouts: team.stats.HKYshutouts,
                HKYsaves: team.stats.HKYsaves,
                HKYsavesPerGame: team.stats.HKYsavesPerGame,
                HKYsavePct: team.stats.HKYsavePct,
                HKYblockedShots: team.stats.HKYblockedShots,
                HKYblockedShotsPerGame: team.stats.HKYblockedShotsPerGame,
                HKYhits: team.stats.HKYhits,
                HKYhitsPerGame: team.stats.HKYhitsPerGame,
                HKYtakeaways: team.stats.HKYtakeaways,
                HKYtakeawaysPerGame: team.stats.HKYtakeawaysPerGame,
                HKYshotDifferential: team.stats.HKYshotDifferential,
                HKYshotDifferentialPerGame: team.stats.HKYshotDifferentialPerGame,
                HKYgoalDifferentialPerGame: team.stats.HKYgoalDifferentialPerGame,
                HKYpimDifferential: team.stats.HKYpimDifferential,
                HKYpimDifferentialPerGame: team.stats.HKYpimDifferentialPerGame,
                HKYtotalPenalties: team.stats.HKYtotalPenalties,
                HKYpenaltiesPerGame: team.stats.HKYpenaltiesPerGame,
                HKYpenaltyMinutes: team.stats.HKYpenaltyMinutes,
                HKYpenaltyMinutesPerGame: team.stats.HKYpenaltyMinutesPerGame,
            });
            const cleanStats = (stats) => {
                const cleanedStats = {};

                for (const key in stats) {
                    if (stats[key] !== null && stats[key] !== undefined) {
                        cleanedStats[key] = stats[key];
                    }
                }

                return cleanedStats;
            };
            function calculateWinrate(games, sport, homeTeam, awayTeam, homeTeamIndex, awayTeamIndex, predictedWinner, predictionStrength) {

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
            
            const winrate = await calculateWinrate(allPastGames, sport, game.home_team, game.away_team, game.homeTeamIndex, game.awayTeamIndex, game.predictedWinner, game.predictionStrength);
            let normalizedHomeIndex = ((game.homeTeamIndex - indexMin) / (indexMax - indexMin)) * 45
            let normalizedAwayIndex = ((game.awayTeamIndex - indexMin) / (indexMax - indexMin)) * 45
            if(normalizedHomeIndex > 45 || normalizedHomeIndex < 0 || normalizedAwayIndex > 45 || normalizedAwayIndex < 0 ){
                console.log('normalizedHomeIndex', normalizedHomeIndex)
                console.log('normalizedAwayIndex', normalizedAwayIndex)
            }

            // Update the Odds database with the calculated indices
            if (sport.name === game.sport_key) {
                if (past === true) {
                    try {
                        await PastGameOdds.findOneAndUpdate({ 'id': game.id }, {
                            homeTeamIndex: homeIndex,
                            awayTeamIndex: awayIndex,
                            homeTeamScaledIndex: normalizedHomeIndex,
                            awayTeamScaledIndex: normalizedAwayIndex,
                            homeTeamStats: homeTeam ? cleanStats(getCommonStats(homeTeam)) : 'no stat data',
                            awayTeamStats: awayTeam ? cleanStats(getCommonStats(awayTeam)) : 'no stat data',
                            homeTeamlogo: homeTeam ? homeTeam.logo : 'no logo data',
                            awayTeamlogo: awayTeam ? awayTeam.logo : 'no logo data',
                            homeTeamAbbr: homeTeam?.abbreviation,
                            awayTeamAbbr: awayTeam?.abbreviation,
                            winPercent: winrate
                        });
                    } catch (err) {
                        console.log(err)
                    }
                } else {
                    try {
                        await Odds.findOneAndUpdate({ 'id': game.id }, {
                            homeTeamIndex: homeIndex,
                            awayTeamIndex: awayIndex,
                            homeTeamScaledIndex: normalizedHomeIndex,
                            awayTeamScaledIndex: normalizedAwayIndex,
                            homeTeamStats: homeTeam ? cleanStats(getCommonStats(homeTeam)) : 'no stat data',
                            awayTeamStats: awayTeam ? cleanStats(getCommonStats(awayTeam)) : 'no stat data',
                            homeTeamlogo: homeTeam ? homeTeam.logo : 'no logo data',
                            awayTeamlogo: awayTeam ? awayTeam.logo : 'no logo data',
                            homeTeamAbbr: homeTeam?.abbreviation,
                            awayTeamAbbr: awayTeam?.abbreviation,
                            winPercent: winrate
                        });
                    } catch (err) {
                        console.log(err)
                    }
                }


            }
        }
    }

    sportOdds = []
    console.log(`FINSHED INDEXING FOR ${sport.name} @ ${moment().format('HH:mm:ss')}`);
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
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1; // getMonth() returns 0-11, so we add 1 to make it 1-12
        if (sport.multiYear
            && ((currentMonth >= sport.startMonth && currentMonth <= 12) || (currentMonth >= 1 && currentMonth <= sport.endMonth))
            || !sport.multiYear
            && (currentMonth >= sport.startMonth && currentMonth <= sport.endMonth)) {

            const pastGames = await PastGameOdds.find({ sport_key: sport.name })
            const sportWeightDB = await Weights.findOne({ league: sport.name })

            let weightArray = sportWeightDB?.featureImportanceScores

            const usableGames = pastGames.filter((game) => game.predictedWinner === 'home' || game.predictedWinner === 'away')
            console.log(usableGames.length)
            await indexAdjuster(usableGames, sport, pastGames, weightArray, true)

        }

    }

}

module.exports = { adjustnflStats, adjustncaafStats, adjustnhlStats, adjustnbaStats, adjustmlbStats, adjustncaamStats, adjustwncaabStats, indexAdjuster, extractSportWeights, matrixIterator, handleSportWeights, pastGamesReIndex }