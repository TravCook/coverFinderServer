require('dotenv').config()
const { Odds, PastGameOdds, UsaFootballTeam, BasketballTeam, BaseballTeam, HockeyTeam } = require('../models');
const axios = require('axios')
const moment = require('moment')
const fs = require('fs')
const tf = require('@tensorflow/tfjs-node');
const { emitToClients } = require('../socketManager')

// Suppress TensorFlow.js logging
process.env.TF_CPP_MIN_LOG_LEVEL = '3'; // Suppress logs
let nflWeights = []
let nbaWeights = []
let mlbWeights = []
let nhlWeights = []
let ncaafWeights = []
let ncaamWeights = []
let ncaawWeights = []

const retrieveTeamsandStats = async () => {
    for (let i = 0; i < sports.length; i++) {
        let TeamModel;
        switch (sports[i].espnSport) {
            case 'football':
                TeamModel = UsaFootballTeam;
                break;
            case 'basketball':
                TeamModel = BasketballTeam;
                break;
            case 'hockey':
                TeamModel = HockeyTeam;
                break;
            case 'baseball':
                TeamModel = BaseballTeam;
                break;
            default:
                console.error("Unsupported sport:", sports[i].espnSport);
                return;
        }
        let teams
        teams = await TeamModel.find({})
        // Helper function to get the team record URL based on the current month
        const getTeamRecordUrl = (month, startMonth, endMonth, espnSport, league, statYear, espnID) => {
            let type = 2; // Default type
            if (month === startMonth) {
                type = 1; // Pre-season
            } else if (month === endMonth) {
                type = 3; // Post-season
            }
            return `https://sports.core.api.espn.com/v2/sports/${espnSport}/leagues/${league}/seasons/${statYear}/types/${type}/teams/${espnID}/record?lang=en&region=us`;
        };

        // Helper function to process the team record response and update the team
        const updateTeamRecord = (team, teamRecordJson) => {
            try {
                teamRecordJson.items.forEach((item) => {
                    if (item.name === 'overall') {
                        item.stats.forEach((stat) => {
                            if (stat.name === 'pointDifferential') {
                                team.pointDiff = stat.value;
                            }
                        });
                        team.seasonWinLoss = item.displayValue;
                    } else if (item.name === 'Home') {
                        team.homeWinLoss = item.displayValue;
                    } else if (item.name === 'Road' || item.name === 'Away') {
                        team.awayWinLoss = item.displayValue;
                    }
                });
            } catch (err) {
                console.error("Error processing team record:", err);
            }
        };
        // Helper function to update team stats
        const updateTeamStats = (team, statName, value, perGameValue, displayValue, category) => {
            const statMap = {
                'totalPointsPerGame': [{ modelField: 'pointsPerGame', category: 'scoring' }],
                'totalPoints': [{ modelField: 'totalPoints', category: 'scoring' }],
                'firstDowns': [{ modelField: 'totalFirstDowns', category: 'miscellaneous' }],
                'rushingFirstDowns': [{ modelField: 'rushingFirstDowns', category: 'rushing' }],
                'passingFirstDowns': [{ modelField: 'passingFirstDowns', category: 'passing' }],
                'thirdDownConvPct': [{ modelField: 'thirdDownEfficiency', category: 'miscellaneous' }],
                'netPassingYardsPerGame': [{ modelField: 'netPassingYardsPerGame', category: 'passing' }],
                'interceptions': [{ modelField: 'interceptions', category: 'passing' }],
                'completionPct': [{ modelField: 'completionPercent', category: 'passing' }],
                'rushingYards': [{ modelField: 'rushingYards', category: 'rushing' }],
                'rushingYardsPerGame': [{ modelField: 'rushingYardsPerGame', category: 'rushing' }],
                'yardsPerRushAttempt': [{ modelField: 'yardsPerRushAttempt', category: 'rushing' }],
                'netYardsPerGame': [{ modelField: 'yardsPerGame', category: 'passing' }],
                'fieldGoalPct': [{ modelField: 'fGgoodPct', category: 'kicking' }],
                'touchbackPct': [{ modelField: 'touchBackPercentage', category: 'kicking' }],
                'totalPenaltyYards': [
                    { modelField: 'totalPenyards', category: 'miscellaneous' },
                    { modelField: 'averagePenYardsPerGame', isPerGame: true, category: 'miscellaneous' }
                ],
                'totalGiveaways': [{ modelField: 'giveaways', category: 'miscellaneous' }],
                'totalTakeaways': [{ modelField: 'takeaways', category: 'miscellaneous' }],
                'turnOverDifferential': [{ modelField: 'turnoverDiff', category: 'miscellaneous' }],
                'sacks': [
                    { modelField: 'sacksTotal', category: 'defensive' },
                    { modelField: 'sacksPerGame', isPerGame: true, category: 'defensive' }
                ],
                'sackYards': [{ modelField: 'yardsLostPerSack', category: 'defensive' }],
                'passesDefended': [
                    { modelField: 'passesDefended', category: 'defensive' },
                    { modelField: 'passesDefendedPerGame', isPerGame: true, category: 'defensive' }
                ],
                'tacklesForLoss': [
                    { modelField: 'tacklesforLoss', category: 'defensive' },
                    { modelField: 'tacklesforLossPerGame', isPerGame: true, category: 'defensive' }
                ],
                'totalRebounds': [{ modelField: 'ReboundsTotal', category: 'general' }],
                'points': [{ modelField: 'PointsTotal', category: 'offensive' }],
                'avgPoints': [{ modelField: 'pointsPergame', isDisplayValue: true, category: 'offensive' }],
                'blocks': [{ modelField: 'blocksTotal', category: 'defensive' }],
                'avgBlocks': [{ modelField: 'blocksPerGame', isDisplayValue: true, category: 'defensive' }],
                'defensiveRebounds': [{ modelField: 'defensiveRebounds', category: 'defensive' }],
                'avgDefensiveRebounds': [{ modelField: 'defensiveReboundsperGame', isDisplayValue: true, category: 'defensive' }],
                'offensiveRebounds': [{ modelField: 'offensiveRebounds', category: 'offensive' }],
                'avgOffensiveRebounds': [{ modelField: 'offensiveReboundsperGame', isDisplayValue: true, category: 'offensive' }],
                'steals': [{ modelField: 'steals', category: 'defensive' }],
                'avgSteals': [{ modelField: 'stealsperGame', isDisplayValue: true, category: 'defensive' }],
                'effectiveFGPct': [{ modelField: 'effectiveFieldGoalPct', category: 'offensive' }],
                'fieldGoals': [{ modelField: 'fieldGoalMakesperAttempts', isDisplayValue: true, category: 'offensive' }],
                'freeThrows': [{ modelField: 'freeThrowsMadeperAttemps', isDisplayValue: true, category: 'offensive' }],
                'freeThrowPct': [{ modelField: 'freeThrowPct', category: 'offensive' }],
                'totalTurnovers': [{ modelField: 'totalTurnovers', category: 'offensive' }],
                'avgTurnovers': [{ modelField: 'averageTurnovers', isDisplayValue: true, category: 'offensive' }],
                'threePointFieldGoalPct': [{ modelField: 'threePointPct', category: 'offensive' }],
                'trueShootingPct': [{ modelField: 'trueShootingPct', category: 'offensive' }],
                'turnoverRatio': [{ modelField: 'turnoverRatio', category: 'offensive' }],
                'assistTurnoverRatio': [{ modelField: 'assisttoTurnoverRatio', category: 'offensive' }],
                'pointsInPaint': [{ modelField: 'pointsinPaint', category: 'offensive' }],
                'paceFactor': [{ modelField: 'pace', category: 'offensive' }],
                'goals': [{ modelField: 'goals', category: 'offensive' }],
                'avgGoals': [{ modelField: 'goalsPerGame', category: 'offensive' }],
                'assists': [
                    { modelField: 'assists', category: 'offensive' },
                    { modelField: 'assistsPerGame', isPerGame: true, category: 'offensive' }
                ],
                'shotsTotal': [
                    { modelField: 'totalShotsTaken', category: 'offensive' },
                    { modelField: 'shotsTakenPerGame', isDisplayValue: true, category: 'offensive' }
                ],
                'powerPlayGoals': [
                    { modelField: 'powerPlayGoals', category: 'offensive' },
                    { modelField: 'powerPlayGoalsPerGame', isPerGame: true, category: 'offensive' }
                ],
                'powerPlayPct': [{ modelField: 'powerPlayPct', category: 'offensive' }],
                'shootingPct': [{ modelField: 'shootingPct', category: 'offensive' }],
                'faceoffsWon': [
                    { modelField: 'faceoffsWon', category: 'offensive' },
                    { modelField: 'faceoffsWonPerGame', isPerGame: true, category: 'offensive' }
                ],
                'faceoffPercent': [{ modelField: 'faceoffPercent', category: 'offensive' }],
                'giveaways': [{ modelField: 'giveaways', category: 'offensive' }],
                'penaltyMinutes': [
                    { modelField: 'penaltyMinutes', category: 'penalties' },
                    { modelField: 'penaltyMinutesPerGame', isPerGame: true, category: 'penalties' }
                ],
                'goalsAgainst': [{ modelField: 'goalsAgainst', category: 'defensive' }],
                'avgGoalsAgainst': [{ modelField: 'goalsAgainstAverage', category: 'defensive' }],
                'shotsAgainst': [{ modelField: 'shotsAgainst', category: 'defensive' }],
                'avgShotsAgainst': [{ modelField: 'shotsAgainstPerGame', category: 'defensive' }],
                'blockedShots': [
                    { modelField: 'shotsBlocked', category: 'defensive' },
                    { modelField: 'shotsBlockedPerGame', isPerGame: true, category: 'defensive' }
                ],
                'penaltyKillPct': [{ modelField: 'penaltyKillPct', category: 'defensive' }],
                'saves': [
                    { modelField: 'totalSaves', category: 'defensive' },
                    { modelField: 'savePerGame', isPerGame: true, category: 'defensive' }
                ],
                'savePct': [{ modelField: 'savePct', category: 'defensive' }],
                'takeaways': [{ modelField: 'takeaways', category: 'defensive' }],
                'strikeouts': [
                    { modelField: 'strikeoutsTotal', category: 'batting' },
                    { modelField: 'strikeoutsPitchingTotal', category: 'pitching' }
                ],
                'RBIs': [{ modelField: 'rBIsTotal', category: 'batting' }],
                'hits': [{ modelField: 'hitsTotal', category: 'batting' }],
                'stolenBases': [{ modelField: 'stolenBasesTotal', category: 'batting' }],
                'walks': [
                    { modelField: 'walksTotal', category: 'batting' },
                    { modelField: 'walksPitchingTotal', category: 'pitching' }
                ],
                'runs': [{ modelField: 'runsTotal', category: 'batting' }],
                'homeRuns': [{ modelField: 'homeRunsTotal', category: 'batting' }],
                'totalBases': [{ modelField: 'totalBases', category: 'batting' }],
                'extraBaseHits': [{ modelField: 'extraBaseHitsTotal', category: 'batting' }],
                'avg': [{ modelField: 'battingAverageTotal', category: 'batting' }],
                'slugAvg': [{ modelField: 'sluggingPercentage', category: 'batting' }],
                'onBasePct': [{ modelField: 'onBasePercent', category: 'batting' }],
                'OPS': [{ modelField: 'onBasePlusSlugging', category: 'batting' }],
                'stolenBasePct': [{ modelField: 'stolenBasePct', category: 'batting' }],
                'walkToStrikeoutRatio': [{ modelField: 'walkToStrikeoutRatio', category: 'batting' }],
                'saves': [{ modelField: 'saves', category: 'pitching' }],
                'qualityStarts': [{ modelField: 'qualityStarts', category: 'pitching' }],
                'ERA': [{ modelField: 'earnedRunAverage', category: 'pitching' }],
                'WHIP': [{ modelField: 'walksHitsPerInningPitched', category: 'pitching' }],
                'groundToFlyRatio': [{ modelField: 'groundToFlyRatio', category: 'pitching' }],
                'runSupportAvg': [{ modelField: 'runSupportAverage', category: 'pitching' }],
                'opponentAvg': [{ modelField: 'oppBattingAverage', category: 'pitching' }],
                'opponentSlugAvg': [{ modelField: 'oppSlugging', category: 'pitching' }],
                'opponentOPS': [{ modelField: 'oppOPS', category: 'pitching' }],
                'savePct': [{ modelField: 'savePct', category: 'pitching' }],
                'strikeoutsPerNineInnings': [{ modelField: 'strikeoutPerNine', category: 'pitching' }],
                'strikeoutToWalkRatio': [{ modelField: 'strikeoutToWalkRatioPitcher', category: 'pitching' }],
                'doublePlays': [{ modelField: 'doublePlays', category: 'fielding' }],
                'errors': [{ modelField: 'fieldingErrors', category: 'fielding' }],
                'fieldingPct': [{ modelField: 'fieldingPercentage', category: 'fielding' }]
            }


            if (statMap[statName]) {
                // Loop through all mappings for this stat (in case there are multiple)
                for (const statInfo of statMap[statName]) {
                    // Ensure the stats object exists
                    team.stats = team.stats || {};

                    // Check if the category matches
                    if (statInfo.category === category) {
                        const statKey = statInfo.modelField;

                        // If it's a per-game stat, update with perGameValue
                        if (statInfo.isPerGame || statInfo.isDisplayValue) {
                            statInfo.isDisplayValue ? team.stats[statKey] = displayValue : 0
                            statInfo.isPerGame ? team.stats[statKey] = perGameValue : 0;
                        } else {
                            // If it's not a per-game stat, store the regular value
                            team.stats[statKey] = value;
                        }
                    }
                }
            }

            return team;
        };

        const upsertTeamsInBulk = async (teams, sport) => {
            const bulkOps = teams.map(team => {
                // Create a new object without the _id field
                const { _id, ...teamWithoutId } = team;

                if (sport.league === team.league) {
                    return {
                        updateOne: {
                            filter: {
                                'espnID': team.espnID, // Unique to the team
                                'league': sport.league, // Ensures uniqueness within the league
                            },
                            update: { $set: teamWithoutId }, // Ensure you're not updating _id
                            upsert: true,
                        }
                    };
                }

                return null

            }).filter(operation => operation !== null);

            if (bulkOps.length > 0) {
                await TeamModel.bulkWrite(bulkOps);
            }
        };

        const fetchAllTeamData = async (sport, teams, statYear) => {
            const fetchTeamData = async (team, sport) => {
                try {
                    // Fetch team record
                    const teamRecordUrl = getTeamRecordUrl(moment().format('M'), sport.startMonth, sport.endMonth, sport.espnSport, sport.league, sport.statYear, team.espnID);
                    const teamRecordResponse = await fetch(teamRecordUrl);
                    const teamRecordJson = await teamRecordResponse.json();
                    updateTeamRecord(team, teamRecordJson);

                    // Fetch team stats
                    const teamStatResponse = await fetch(`https://sports.core.api.espn.com/v2/sports/${sport.espnSport}/leagues/${sport.league}/seasons/${statYear}/types/2/teams/${team.espnID}/statistics?lang=en&region=us`);
                    const teamStatJson = await teamStatResponse.json();
                    if (teamStatJson.splits) {
                        for (const category of teamStatJson.splits.categories) {
                            for (const stat of category.stats) {
                                team = updateTeamStats(team, stat.name, stat.value, stat.perGameValue, stat.displayValue, category.name);
                            }
                        }
                    }
                    return team;  // Return the updated team
                } catch (error) {
                    console.log(`Error fetching data for team ${team.espnID}:`, error);
                }
            };

            const MAX_CONCURRENT_REQUESTS = 25; // You can adjust this number to control concurrency
            const promises = [];

            try {
                // Loop through each team and fetch their data
                for (let team of teams) {
                    promises.push(fetchTeamData(team, sport).then(updatedTeam => {
                        if (updatedTeam) {
                            return updatedTeam; // Add the updated team to the result
                        }
                    }));

                    // If we reach the maximum number of concurrent requests, wait for them to resolve
                    if (promises.length >= MAX_CONCURRENT_REQUESTS) {
                        // Wait for all current promises to resolve
                        const results = await Promise.all(promises);
                        // Filter out any undefined results (in case some fetches failed)
                        const filteredResults = results.filter(result => result !== undefined);
                        // Upsert the fetched team data in bulk
                        await upsertTeamsInBulk(filteredResults, sport);
                        promises.length = 0; // Clear the array after waiting for requests to resolve
                    }
                }

                // After all requests have been processed, make sure to upsert the remaining teams
                if (promises.length > 0) {
                    const results = await Promise.all(promises);
                    const filteredResults = results.filter(result => result !== undefined);
                    await upsertTeamsInBulk(filteredResults, sport);
                }

            } catch (error) {
                console.error("Error fetching or processing team data:", error);
            }
        };
        fetchAllTeamData(sports[i], teams, sports[i].statYear)
    }
    console.log(`Finished TEAM SEEDING @ ${moment().format('HH:mm:ss')}`)
}

const removePastGames = async (currentOdds) => {
    for (let game of currentOdds) {
        // Check if the game is in the past based on commence_time
        if (moment(game.commence_time).local().isBefore(moment().local())) {
            let { _id, ...newGame } = game._doc;
            let homeScore, awayScore, predictionCorrect, winner, timeRemaining;
            let homeTeamList = []
            let awayTeamList = []
            let homeTeam
            let awayTeam

            // Fetch team data based on sport
            if (game.sport === 'football') {
                homeTeamList = await UsaFootballTeam.find({ 'espnDisplayName': game.home_team });
                awayTeamList = await UsaFootballTeam.find({ 'espnDisplayName': game.away_team });
            } else if (game.sport === 'baseball') {
                homeTeamList = await BaseballTeam.find({ 'espnDisplayName': game.home_team });
                awayTeamList = await BaseballTeam.find({ 'espnDisplayName': game.away_team });
            } else if (game.sport === 'basketball') {
                homeTeamList = await BasketballTeam.find({ 'espnDisplayName': game.home_team });
                awayTeamList = await BasketballTeam.find({ 'espnDisplayName': game.away_team });
            } else if (game.sport === 'hockey') {
                homeTeamList = await HockeyTeam.find({ 'espnDisplayName': game.home_team });
                awayTeamList = await HockeyTeam.find({ 'espnDisplayName': game.away_team });
            }




            // Function to find a team based on schedule date
            async function findTeamSchedule(teamList, teamType) {
                if (teamList.length > 1) {
                    // Loop through teams if there are multiple
                    for (let idx = 0; idx < teamList.length; idx++) {
                        let team = teamList[idx];
                        try {
                            // Fetch team schedule from ESPN API
                            let scheduleResponse = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${game.sport}/${team.league}/teams/${team.espnID}/schedule`);
                            let scheduleJSON = await scheduleResponse.json();

                            // Loop through events in the team's schedule
                            for (let event of scheduleJSON.events) {
                                // Check if the event matches the current game's date
                                if (moment(event.date).isSame(moment(game.commence_time), 'hour')) {
                                    if (teamType === 'home') {
                                        homeTeam = teamList[idx];
                                    } else if (teamType === 'away') {
                                        awayTeam = teamList[idx];
                                    }
                                }
                            }
                        } catch (error) {
                            console.error(`Error fetching schedule for ${team.espnDisplayName}:`, error);
                        }
                    }
                } else if (teamList.length === 1) {
                    // If only one team is found, assign it directly
                    if (teamType === 'home') {
                        homeTeam = teamList[0];
                    } else if (teamType === 'away') {
                        awayTeam = teamList[0];
                    }
                } else if (teamList.length === 0) {
                    console.log(game.id)
                    // if (game.id === '386b527dff39523d361ab43df5a85a5a') {
                    //     await Odds.deleteOne({ id: game.id });
                    // }
                }
            }


            // Call the function to check home and away teams
            await findTeamSchedule(homeTeamList, 'home');
            await findTeamSchedule(awayTeamList, 'away');

            try {
                // Fetch home team schedule from ESPN API
                let homeTeamSchedule = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${game.sport}/${homeTeam.league}/teams/${homeTeam.espnID}/schedule`);
                let homeTeamSchedJSON = await homeTeamSchedule.json();

                // Loop through events in the home team schedule
                for (let event of homeTeamSchedJSON.events) {

                    // Check if the event matches the current game's date
                    if (moment(event.date).isSame(moment(game.commence_time), 'hour')) {
                        if (event.competitions[0].status.type.completed === true) {

                            // Determine the scores and winner
                            event.competitions[0].competitors.forEach((team) => {
                                if (team.homeAway === 'home') {
                                    homeScore = team.score.value; // home score
                                } else if (team.homeAway === 'away') {
                                    awayScore = team.score.value; // away score
                                }
                            });

                            // Determine winner
                            winner = homeScore > awayScore ? 'home' : 'away';

                            // Check if the prediction was correct
                            if (game.homeTeamIndex >= game.awayTeamIndex) {
                                predictionCorrect = winner === 'home';
                            } else if (game.awayTeamIndex > game.homeTeamIndex) {
                                predictionCorrect = winner === 'away';
                            }
                            const getCommonStats = (team) => ({
                                seasonWinLoss: team.seasonWinLoss,
                                homeWinLoss: team.homeWinLoss,
                                awayWinLoss: team.awayWinLoss,
                                pointDiff: team.pointDiff,
                                pointsPerGame: team.stats.pointsPerGame,
                                totalPoints: team.stats.totalPoints,
                                totalFirstDowns: team.stats.totalFirstDowns,
                                rushingFirstDowns: team.stats.rushingFirstDowns,
                                passingFirstDowns: team.stats.passingFirstDowns,
                                thirdDownEfficiency: team.stats.thirdDownEfficiency,
                                netPassingYardsPerGame: team.stats.netPassingYardsPerGame,
                                interceptions: team.stats.interceptions,
                                completionPercent: team.stats.completionPercent,
                                rushingYards: team.stats.rushingYards,
                                rushingYardsPerGame: team.stats.rushingYardsPerGame,
                                yardsPerRushAttempt: team.stats.yardsPerRushAttempt,
                                yardsPerGame: team.stats.yardsPerGame,
                                fGgoodPct: team.stats.fGgoodPct,
                                touchBackPercentage: team.stats.touchBackPercentage,
                                totalPenyards: team.stats.totalPenyards,
                                averagePenYardsPerGame: team.stats.averagePenYardsPerGame,
                                giveaways: team.stats.giveaways,
                                takeaways: team.stats.takeaways,
                                turnoverDiff: team.stats.turnoverDiff,
                                sacksTotal: team.stats.sacksTotal,
                                sacksPerGame: team.stats.sacksPerGame,
                                yardsLostPerSack: team.stats.yardsLostPerSack,
                                passesDefended: team.stats.passesDefended,
                                passesDefendedPerGame: team.stats.passesDefendedPerGame,
                                tacklesforLoss: team.stats.tacklesforLoss,
                                tacklesforLossPerGame: team.stats.tacklesforLossPerGame,
                                strikeoutsTotal: team.stats.strikeoutsTotal,
                                rBIsTotal: team.stats.rBIsTotal,
                                hitsTotal: team.stats.hitsTotal,
                                stolenBasesTotal: team.stats.stolenBasesTotal,
                                walksTotal: team.stats.walksTotal,
                                runsTotal: team.stats.runsTotal,
                                homeRunsTotal: team.stats.homeRunsTotal,
                                totalBases: team.stats.totalBases,
                                extraBaseHitsTotal: team.stats.extraBaseHitsTotal,
                                battingAverageTotal: team.stats.battingAverageTotal,
                                sluggingPercentage: team.stats.sluggingPercentage,
                                onBasePercent: team.stats.onBasePercent,
                                onBasePlusSlugging: team.stats.onBasePlusSlugging,
                                stolenBasePct: team.stats.stolenBasePct,
                                walkToStrikeoutRatio: team.stats.walkToStrikeoutRatio,
                                saves: team.stats.saves,
                                strikeoutsPitchingTotal: team.stats.strikeoutsPitchingTotal,
                                walksPitchingTotal: team.stats.walksPitchingTotal,
                                qualityStarts: team.stats.qualityStarts,
                                earnedRunAverage: team.stats.earnedRunAverage,
                                walksHitsPerInningPitched: team.stats.walksHitsPerInningPitched,
                                groundToFlyRatio: team.stats.groundToFlyRatio,
                                runSupportAverage: team.stats.runSupportAverage,
                                oppBattingAverage: team.stats.oppBattingAverage,
                                oppSlugging: team.stats.oppSlugging,
                                oppOPS: team.stats.oppOPS,
                                savePct: team.stats.savePct,
                                strikeoutPerNine: team.stats.strikeoutPerNine,
                                strikeoutToWalkRatioPitcher: team.stats.strikeoutToWalkRatioPitcher,
                                doublePlays: team.stats.doublePlays,
                                fieldingErrors: team.stats.fieldingErrors,
                                fieldingPercentage: team.stats.fieldingPercentage,
                                ReboundsTotal: team.stats.ReboundsTotal,
                                PointsTotal: team.stats.PointsTotal,
                                pointsPergame: team.stats.pointsPergame,
                                blocksTotal: team.stats.blocksTotal,
                                blocksPerGame: team.stats.blocksPerGame,
                                defensiveRebounds: team.stats.defensiveRebounds,
                                defensiveReboundsperGame: team.stats.defensiveReboundsperGame,
                                offensiveRebounds: team.stats.offensiveRebounds,
                                offensiveReboundsperGame: team.stats.offensiveReboundsperGame,
                                steals: team.stats.steals,
                                stealsperGame: team.stats.stealsperGame,
                                effectiveFieldGoalPct: team.stats.effectiveFieldGoalPct,
                                fieldGoalMakesperAttempts: team.stats.fieldGoalMakesperAttempts,
                                freeThrowsMadeperAttemps: team.stats.freeThrowsMadeperAttemps,
                                freeThrowPct: team.stats.freeThrowPct,
                                totalTurnovers: team.stats.totalTurnovers,
                                averageTurnovers: team.stats.averageTurnovers,
                                threePointPct: team.stats.threePointPct,
                                trueShootingPct: team.stats.trueShootingPct,
                                turnoverRatio: team.stats.turnoverRatio,
                                assisttoTurnoverRatio: team.stats.assisttoTurnoverRatio,
                                pointsinPaint: team.stats.pointsinPaint,
                                pace: team.stats.pace,
                                goals: team.stats.goals,
                                goalsPerGame: team.stats.goalsPerGame,
                                assists: team.stats.assists,
                                assistsPerGame: team.stats.assistsPerGame,
                                totalShotsTaken: team.stats.totalShotsTaken,
                                shotsTakenPerGame: team.stats.shotsTakenPerGame,
                                powerPlayGoals: team.stats.powerPlayGoals,
                                powerPlayGoalsPerGame: team.stats.powerPlayGoalsPerGame,
                                powerPlayPct: team.stats.powerPlayPct,
                                shootingPct: team.stats.shootingPct,
                                faceoffsWon: team.stats.faceoffsWon,
                                faceoffsWonPerGame: team.stats.faceoffsWonPerGame,
                                faceoffPercent: team.stats.faceoffPercent,
                                giveaways: team.stats.giveaways,
                                penaltyMinutes: team.stats.penaltyMinutes,
                                penaltyMinutesPerGame: team.stats.penaltyMinutesPerGame,
                                goalsAgainst: team.stats.goalsAgainst,
                                goalsAgainstAverage: team.stats.goalsAgainstAverage,
                                shotsAgainst: team.stats.shotsAgainst,
                                shotsAgainstPerGame: team.stats.shotsAgainstPerGame,
                                shotsBlocked: team.stats.shotsBlocked,
                                shotsBlockedPerGame: team.stats.shotsBlockedPerGame,
                                penaltyKillPct: team.stats.penaltyKillPct,
                                totalSaves: team.stats.totalSaves,
                                savePerGame: team.stats.savePerGame,
                                savePct: team.stats.savePct,
                                takeaways: team.stats.takeaways,
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
                            // Save the past game to the PastGameOdds collection
                            // Check if the game already exists in the PastGameOdds collection
                            const existingGame = await PastGameOdds.findOne({
                                home_team: game.home_team,
                                away_team: game.away_team,
                                commence_time: game.commence_time
                            });

                            if (!existingGame) {
                                // If no existing record, create a new entry
                                await PastGameOdds.create({
                                    ...newGame,
                                    homeScore,
                                    awayScore,
                                    winner,
                                    predictionCorrect,
                                    homeTeamStats: cleanStats(getCommonStats(homeTeam)),
                                    awayTeamStats: cleanStats(getCommonStats(awayTeam)),
                                });

                                // Delete the game from the Odds collection
                                let deletedGame = await Odds.findOneAndDelete({ _id: game._doc._id });
                                if (deletedGame) {
                                    console.log(`deleted game: ${deletedGame.home_team} vs ${deletedGame.away_team}`);
                                }
                            } else {
                                console.log('Game already exists in PastGameOdds');
                            }
                        } else if (event.competitions[0].status.type.description === 'In Progress' || event.competitions[0].status.type.description === 'Halftime' || event.competitions[0].status.type.description === 'End of Period') {
                            let currentScoreboard = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${game.sport}/${homeTeam.league}/scoreboard`)
                            let scoreboardJSON = await currentScoreboard.json()
                            for (let SBevent of scoreboardJSON.events) {
                                if (moment(SBevent.date).isSame(moment(game.commence_time), 'hour') && (SBevent.name === `${game.away_team} at ${game.home_team}` || SBevent.shortName === `${awayTeam.abbreviation} @ ${homeTeam.abbreviation}`)) {
                                    // Determine the scores and winner
                                    SBevent.competitions[0].competitors.forEach((team) => {
                                        if (team.homeAway === 'home') {
                                            homeScore = parseInt(team.score); // home score
                                        } else if (team.homeAway === 'away') {
                                            awayScore = parseInt(team.score); // away score
                                        }
                                    });

                                    timeRemaining = SBevent.competitions[0].status.type.shortDetail
                                    try {
                                        await Odds.findOneAndUpdate({ _id: game._doc._id }, {
                                            ...newGame,
                                            homeScore: homeScore,
                                            awayScore: awayScore,
                                            timeRemaining: timeRemaining,
                                        }, { new: true });

                                    } catch (error) {
                                        console.error('Error updating game:', error);
                                    }

                                }


                            }
                        } else if (event.competitions[0].status.type.description === 'Postponed') {
                            // Delete the game from the Odds collection
                            let deletedGame = await Odds.findOneAndDelete({ _id: game._doc._id });
                            if (deletedGame) {
                                console.log(`deleted game: ${deletedGame.home_team} vs ${deletedGame.away_team}`);
                            }
                        }
                    }
                }
            } catch (err) {
                console.log(err); // Log any errors encountered during the API call or processing
            }
        }
    }
}
const getStat = (stats, statName, fallbackValue = 0) => {
    return stats && stats[statName] !== undefined ? stats[statName] : fallbackValue;
};
// Helper function to calculate Win-Loss difference
const getWinLoss = (stats) => {
    if (stats && stats.seasonWinLoss) {
        const winLoss = stats.seasonWinLoss.split("-");
        if (winLoss.length === 2) {
            return parseInt(winLoss[0], 10) - parseInt(winLoss[1], 10); // Difference in wins and losses
        }
    }
    return 0;
};
// Helper function to extract home/away win-loss
const getHomeAwayWinLoss = (stats, type) => {
    if (stats && stats[type]) {
        const winLoss = stats[type].split("-");
        if (winLoss.length === 2) {
            return parseInt(winLoss[0], 10) - parseInt(winLoss[1], 10); // Difference in home/away win-loss
        }
    }
    return 0;
};
// Feature extraction per sport
function extractSportFeatures(homeStats, awayStats, league) {
    switch (league) {
        case 'americanfootball_nfl':
            return [
                getWinLoss(homeStats) - getWinLoss(awayStats),
                getHomeAwayWinLoss(homeStats, 'homeWinLoss') - getHomeAwayWinLoss(awayStats, 'awayWinLoss'),
                getStat(homeStats, 'pointDiff') - getStat(awayStats, 'pointDiff'),
                getStat(homeStats, 'pointsPerGame') - getStat(awayStats, 'pointsPerGame'),
                getStat(homeStats, 'totalPoints') - getStat(awayStats, 'totalPoints'),
                getStat(homeStats, 'totalFirstDowns') - getStat(awayStats, 'totalFirstDowns'),
                getStat(homeStats, 'rushingFirstDowns') - getStat(awayStats, 'rushingFirstDowns'),
                getStat(homeStats, 'passingFirstDowns') - getStat(awayStats, 'passingFirstDowns'),
                getStat(homeStats, 'thirdDownEfficiency') - getStat(awayStats, 'thirdDownEfficiency'),
                getStat(homeStats, 'netPassingYardsPerGame') - getStat(awayStats, 'netPassingYardsPerGame'),
                getStat(homeStats, 'interceptions') - getStat(awayStats, 'interceptions'),
                getStat(homeStats, 'completionPercent') - getStat(awayStats, 'completionPercent'),
                getStat(homeStats, 'rushingYards') - getStat(awayStats, 'rushingYards'),
                getStat(homeStats, 'rushingYardsPerGame') - getStat(awayStats, 'rushingYardsPerGame'),
                getStat(homeStats, 'yardsPerRushAttempt') - getStat(awayStats, 'yardsPerRushAttempt'),
                getStat(homeStats, 'yardsPerGame') - getStat(awayStats, 'yardsPerGame'),
                getStat(homeStats, 'fGgoodPct') - getStat(awayStats, 'fGgoodPct'),
                getStat(homeStats, 'touchBackPercentage') - getStat(awayStats, 'touchBackPercentage'),
                getStat(homeStats, 'totalPenyards') - getStat(awayStats, 'totalPenyards'),
                getStat(homeStats, 'averagePenYardsPerGame') - getStat(awayStats, 'averagePenYardsPerGame'),
                getStat(homeStats, 'giveaways') - getStat(awayStats, 'giveaways'),
                getStat(homeStats, 'takeaways') - getStat(awayStats, 'takeaways'),
                getStat(homeStats, 'turnoverDiff') - getStat(awayStats, 'turnoverDiff'),
                getStat(homeStats, 'sacksTotal') - getStat(awayStats, 'sacksTotal'),
                getStat(homeStats, 'sacksPerGame') - getStat(awayStats, 'sacksPerGame'),
                getStat(homeStats, 'yardsLostPerSack') - getStat(awayStats, 'yardsLostPerSack'),
                getStat(homeStats, 'passesDefended') - getStat(awayStats, 'passesDefended'),
                getStat(homeStats, 'passesDefendedPerGame') - getStat(awayStats, 'passesDefendedPerGame'),
                getStat(homeStats, 'tacklesforLoss') - getStat(awayStats, 'tacklesforLoss'),
                getStat(homeStats, 'tacklesforLossPerGame') - getStat(awayStats, 'tacklesforLossPerGame'),
            ];
        case 'americanfootball_ncaaf':
            return [
                getWinLoss(homeStats) - getWinLoss(awayStats),
                getHomeAwayWinLoss(homeStats, 'homeWinLoss') - getHomeAwayWinLoss(awayStats, 'awayWinLoss'),
                getStat(homeStats, 'pointDiff') - getStat(awayStats, 'pointDiff'),
                getStat(homeStats, 'pointsPerGame') - getStat(awayStats, 'pointsPerGame'),
                getStat(homeStats, 'totalPoints') - getStat(awayStats, 'totalPoints'),
                getStat(homeStats, 'totalFirstDowns') - getStat(awayStats, 'totalFirstDowns'),
                getStat(homeStats, 'rushingFirstDowns') - getStat(awayStats, 'rushingFirstDowns'),
                getStat(homeStats, 'passingFirstDowns') - getStat(awayStats, 'passingFirstDowns'),
                getStat(homeStats, 'thirdDownEfficiency') - getStat(awayStats, 'thirdDownEfficiency'),
                getStat(homeStats, 'netPassingYardsPerGame') - getStat(awayStats, 'netPassingYardsPerGame'),
                getStat(homeStats, 'interceptions') - getStat(awayStats, 'interceptions'),
                getStat(homeStats, 'completionPercent') - getStat(awayStats, 'completionPercent'),
                getStat(homeStats, 'rushingYards') - getStat(awayStats, 'rushingYards'),
                getStat(homeStats, 'rushingYardsPerGame') - getStat(awayStats, 'rushingYardsPerGame'),
                getStat(homeStats, 'yardsPerRushAttempt') - getStat(awayStats, 'yardsPerRushAttempt'),
                getStat(homeStats, 'yardsPerGame') - getStat(awayStats, 'yardsPerGame'),
                getStat(homeStats, 'fGgoodPct') - getStat(awayStats, 'fGgoodPct'),
                getStat(homeStats, 'touchBackPercentage') - getStat(awayStats, 'touchBackPercentage'),
                getStat(homeStats, 'totalPenyards') - getStat(awayStats, 'totalPenyards'),
                getStat(homeStats, 'averagePenYardsPerGame') - getStat(awayStats, 'averagePenYardsPerGame'),
                getStat(homeStats, 'giveaways') - getStat(awayStats, 'giveaways'),
                getStat(homeStats, 'takeaways') - getStat(awayStats, 'takeaways'),
                getStat(homeStats, 'turnoverDiff') - getStat(awayStats, 'turnoverDiff'),
                getStat(homeStats, 'sacksTotal') - getStat(awayStats, 'sacksTotal'),
                getStat(homeStats, 'sacksPerGame') - getStat(awayStats, 'sacksPerGame'),
                getStat(homeStats, 'yardsLostPerSack') - getStat(awayStats, 'yardsLostPerSack'),
                getStat(homeStats, 'passesDefended') - getStat(awayStats, 'passesDefended'),
                getStat(homeStats, 'passesDefendedPerGame') - getStat(awayStats, 'passesDefendedPerGame'),
                getStat(homeStats, 'tacklesforLoss') - getStat(awayStats, 'tacklesforLoss'),
                getStat(homeStats, 'tacklesforLossPerGame') - getStat(awayStats, 'tacklesforLossPerGame'),
            ];
        case 'icehockey_nhl':
            return [
                getWinLoss(homeStats) - getWinLoss(awayStats),
                getHomeAwayWinLoss(homeStats, 'homeWinLoss') - getHomeAwayWinLoss(awayStats, 'awayWinLoss'),
                getStat(homeStats, 'pointDiff') - getStat(awayStats, 'pointDiff'),
                getStat(homeStats, 'goals') - getStat(awayStats, 'goals'),
                getStat(homeStats, 'goalsPerGame') - getStat(awayStats, 'goalsPerGame'),
                getStat(homeStats, 'assists') - getStat(awayStats, 'assists'),
                getStat(homeStats, 'assistsPerGame') - getStat(awayStats, 'assistsPerGame'),
                getStat(homeStats, 'totalShotsTaken') - getStat(awayStats, 'totalShotsTaken'),
                getStat(homeStats, 'shotsTakenPerGame') - getStat(awayStats, 'shotsTakenPerGame'),
                getStat(homeStats, 'powerPlayGoals') - getStat(awayStats, 'powerPlayGoals'),
                getStat(homeStats, 'powerPlayGoalsPerGame') - getStat(awayStats, 'powerPlayGoalsPerGame'),
                getStat(homeStats, 'powerPlayPct') - getStat(awayStats, 'powerPlayPct'),
                getStat(homeStats, 'shootingPct') - getStat(awayStats, 'shootingPct'),
                getStat(homeStats, 'faceoffsWon') - getStat(awayStats, 'faceoffsWon'),
                getStat(homeStats, 'faceoffsWonPerGame') - getStat(awayStats, 'faceoffsWonPerGame'),
                getStat(homeStats, 'faceoffPercent') - getStat(awayStats, 'faceoffPercent'),
                getStat(homeStats, 'giveaways') - getStat(awayStats, 'giveaways'),
                getStat(homeStats, 'penaltyMinutes') - getStat(awayStats, 'penaltyMinutes'),
                getStat(homeStats, 'penaltyMinutesPerGame') - getStat(awayStats, 'penaltyMinutesPerGame'),
                getStat(homeStats, 'goalsAgainst') - getStat(awayStats, 'goalsAgainst'),
                getStat(homeStats, 'goalsAgainstAverage') - getStat(awayStats, 'goalsAgainstAverage'),
                getStat(homeStats, 'shotsAgainst') - getStat(awayStats, 'shotsAgainst'),
                getStat(homeStats, 'shotsAgainstPerGame') - getStat(awayStats, 'shotsAgainstPerGame'),
                getStat(homeStats, 'shotsBlocked') - getStat(awayStats, 'shotsBlocked'),
                getStat(homeStats, 'shotsBlockedPerGame') - getStat(awayStats, 'shotsBlockedPerGame'),
                getStat(homeStats, 'penaltyKillPct') - getStat(awayStats, 'penaltyKillPct'),
                getStat(homeStats, 'totalSaves') - getStat(awayStats, 'totalSaves'),
                getStat(homeStats, 'savePerGame') - getStat(awayStats, 'savePerGame'),
                getStat(homeStats, 'savePct') - getStat(awayStats, 'savePct'),
                getStat(homeStats, 'takeaways') - getStat(awayStats, 'takeaways'),

            ];
        case 'baseball_mlb':
            return [
                getWinLoss(homeStats) - getWinLoss(awayStats),
                getHomeAwayWinLoss(homeStats, 'homeWinLoss') - getHomeAwayWinLoss(awayStats, 'awayWinLoss'),
                getStat(homeStats, 'pointDiff') - getStat(awayStats, 'pointDiff'),
                getStat(homeStats, 'strikeoutsTotal') - getStat(awayStats, 'strikeoutsTotal'),
                getStat(homeStats, 'rBIsTotal') - getStat(awayStats, 'rBIsTotal'),
                getStat(homeStats, 'hitsTotal') - getStat(awayStats, 'hitsTotal'),
                getStat(homeStats, 'stolenBasesTotal') - getStat(awayStats, 'stolenBasesTotal'),
                getStat(homeStats, 'walksTotal') - getStat(awayStats, 'walksTotal'),
                getStat(homeStats, 'runsTotal') - getStat(awayStats, 'runsTotal'),
                getStat(homeStats, 'homeRunsTotal') - getStat(awayStats, 'homeRunsTotal'),
                getStat(homeStats, 'extraBaseHitsTotal') - getStat(awayStats, 'extraBaseHitsTotal'),
                getStat(homeStats, 'battingAverageTotal') - getStat(awayStats, 'battingAverageTotal'),
                getStat(homeStats, 'sluggingPercentage') - getStat(awayStats, 'sluggingPercentage'),
                getStat(homeStats, 'onBasePercent') - getStat(awayStats, 'onBasePercent'),
                getStat(homeStats, 'onBasePlusSlugging') - getStat(awayStats, 'onBasePlusSlugging'),
                getStat(homeStats, 'stolenBasePct') - getStat(awayStats, 'stolenBasePct'),
                getStat(homeStats, 'walkToStrikeoutRatio') - getStat(awayStats, 'walkToStrikeoutRatio'),
                getStat(homeStats, 'saves') - getStat(awayStats, 'saves'),
                getStat(homeStats, 'strikeoutsPitchingTotal') - getStat(awayStats, 'strikeoutsPitchingTotal'),
                getStat(homeStats, 'walksPitchingTotal') - getStat(awayStats, 'walksPitchingTotal'),
                getStat(homeStats, 'qualityStarts') - getStat(awayStats, 'qualityStarts'),
                getStat(homeStats, 'earnedRunAverage') - getStat(awayStats, 'earnedRunAverage'),
                getStat(homeStats, 'walksHitsPerInningPitched') - getStat(awayStats, 'walksHitsPerInningPitched'),
                getStat(homeStats, 'groundToFlyRatio') - getStat(awayStats, 'groundToFlyRatio'),
                getStat(homeStats, 'runSupportAverage') - getStat(awayStats, 'runSupportAverage'),
                getStat(homeStats, 'oppBattingAverage') - getStat(awayStats, 'oppBattingAverage'),
                getStat(homeStats, 'oppSlugging') - getStat(awayStats, 'oppSlugging'),
                getStat(homeStats, 'oppOPS') - getStat(awayStats, 'oppOPS'),
                getStat(homeStats, 'savePct') - getStat(awayStats, 'savePct'),
                getStat(homeStats, 'strikeoutPerNine') - getStat(awayStats, 'strikeoutPerNine'),
                getStat(homeStats, 'strikeoutToWalkRatioPitcher') - getStat(awayStats, 'strikeoutToWalkRatioPitcher'),
                getStat(homeStats, 'doublePlays') - getStat(awayStats, 'doublePlays'),
                getStat(homeStats, 'fieldingErrors') - getStat(awayStats, 'fieldingErrors'),
                getStat(homeStats, 'fieldingPercentage') - getStat(awayStats, 'fieldingPercentage'),
            ];
        case 'basketball_ncaab':
            return [
                getWinLoss(homeStats) - getWinLoss(awayStats),
                getHomeAwayWinLoss(homeStats, 'homeWinLoss') - getHomeAwayWinLoss(awayStats, 'awayWinLoss'),
                getStat(homeStats, 'pointDiff') - getStat(awayStats, 'pointDiff'),
                getStat(homeStats, 'ReboundsTotal') - getStat(awayStats, 'ReboundsTotal'),
                getStat(homeStats, 'PointsTotal') - getStat(awayStats, 'PointsTotal'),
                getStat(homeStats, 'pointsPergame') - getStat(awayStats, 'pointsPergame'),
                getStat(homeStats, 'blocksTotal') - getStat(awayStats, 'blocksTotal'),
                getStat(homeStats, 'blocksPerGame') - getStat(awayStats, 'blocksPerGame'),
                getStat(homeStats, 'defensiveRebounds') - getStat(awayStats, 'defensiveRebounds'),
                getStat(homeStats, 'defensiveReboundsperGame') - getStat(awayStats, 'defensiveReboundsperGame'),
                getStat(homeStats, 'offensiveRebounds') - getStat(awayStats, 'offensiveRebounds'),
                getStat(homeStats, 'offensiveReboundsperGame') - getStat(awayStats, 'offensiveReboundsperGame'),
                getStat(homeStats, 'steals') - getStat(awayStats, 'steals'),
                getStat(homeStats, 'stealsperGame') - getStat(awayStats, 'stealsperGame'),
                getStat(homeStats, 'effectiveFieldGoalPct') - getStat(awayStats, 'effectiveFieldGoalPct'),
                getStat(homeStats, 'freeThrowPct') - getStat(awayStats, 'freeThrowPct'),
                getStat(homeStats, 'totalTurnovers') - getStat(awayStats, 'totalTurnovers'),
                getStat(homeStats, 'averageTurnovers') - getStat(awayStats, 'averageTurnovers'),
                getStat(homeStats, 'threePointPct') - getStat(awayStats, 'threePointPct'),
                getStat(homeStats, 'trueShootingPct') - getStat(awayStats, 'trueShootingPct'),
                getStat(homeStats, 'turnoverRatio') - getStat(awayStats, 'turnoverRatio'),
                getStat(homeStats, 'assisttoTurnoverRatio') - getStat(awayStats, 'assisttoTurnoverRatio'),
                getStat(homeStats, 'pointsinPaint') - getStat(awayStats, 'pointsinPaint'),
                getStat(homeStats, 'pace') - getStat(awayStats, 'pace'),
            ];
        case 'basketball_wncaab':
            return [
                getWinLoss(homeStats) - getWinLoss(awayStats),
                getHomeAwayWinLoss(homeStats, 'homeWinLoss') - getHomeAwayWinLoss(awayStats, 'awayWinLoss'),
                getStat(homeStats, 'pointDiff') - getStat(awayStats, 'pointDiff'),
                getStat(homeStats, 'ReboundsTotal') - getStat(awayStats, 'ReboundsTotal'),
                getStat(homeStats, 'PointsTotal') - getStat(awayStats, 'PointsTotal'),
                getStat(homeStats, 'pointsPergame') - getStat(awayStats, 'pointsPergame'),
                getStat(homeStats, 'blocksTotal') - getStat(awayStats, 'blocksTotal'),
                getStat(homeStats, 'blocksPerGame') - getStat(awayStats, 'blocksPerGame'),
                getStat(homeStats, 'defensiveRebounds') - getStat(awayStats, 'defensiveRebounds'),
                getStat(homeStats, 'defensiveReboundsperGame') - getStat(awayStats, 'defensiveReboundsperGame'),
                getStat(homeStats, 'offensiveRebounds') - getStat(awayStats, 'offensiveRebounds'),
                getStat(homeStats, 'offensiveReboundsperGame') - getStat(awayStats, 'offensiveReboundsperGame'),
                getStat(homeStats, 'steals') - getStat(awayStats, 'steals'),
                getStat(homeStats, 'stealsperGame') - getStat(awayStats, 'stealsperGame'),
                getStat(homeStats, 'effectiveFieldGoalPct') - getStat(awayStats, 'effectiveFieldGoalPct'),
                getStat(homeStats, 'freeThrowPct') - getStat(awayStats, 'freeThrowPct'),
                getStat(homeStats, 'totalTurnovers') - getStat(awayStats, 'totalTurnovers'),
                getStat(homeStats, 'averageTurnovers') - getStat(awayStats, 'averageTurnovers'),
                getStat(homeStats, 'threePointPct') - getStat(awayStats, 'threePointPct'),
                getStat(homeStats, 'trueShootingPct') - getStat(awayStats, 'trueShootingPct'),
                getStat(homeStats, 'turnoverRatio') - getStat(awayStats, 'turnoverRatio'),
                getStat(homeStats, 'assisttoTurnoverRatio') - getStat(awayStats, 'assisttoTurnoverRatio'),
                getStat(homeStats, 'pointsinPaint') - getStat(awayStats, 'pointsinPaint'),
                getStat(homeStats, 'pace') - getStat(awayStats, 'pace'),
            ];
        case 'basketball_nba':
            return [
                getWinLoss(homeStats) - getWinLoss(awayStats),
                getHomeAwayWinLoss(homeStats, 'homeWinLoss') - getHomeAwayWinLoss(awayStats, 'awayWinLoss'),
                getStat(homeStats, 'pointDiff') - getStat(awayStats, 'pointDiff'),
                getStat(homeStats, 'ReboundsTotal') - getStat(awayStats, 'ReboundsTotal'),
                getStat(homeStats, 'PointsTotal') - getStat(awayStats, 'PointsTotal'),
                getStat(homeStats, 'pointsPergame') - getStat(awayStats, 'pointsPergame'),
                getStat(homeStats, 'blocksTotal') - getStat(awayStats, 'blocksTotal'),
                getStat(homeStats, 'blocksPerGame') - getStat(awayStats, 'blocksPerGame'),
                getStat(homeStats, 'defensiveRebounds') - getStat(awayStats, 'defensiveRebounds'),
                getStat(homeStats, 'defensiveReboundsperGame') - getStat(awayStats, 'defensiveReboundsperGame'),
                getStat(homeStats, 'offensiveRebounds') - getStat(awayStats, 'offensiveRebounds'),
                getStat(homeStats, 'offensiveReboundsperGame') - getStat(awayStats, 'offensiveReboundsperGame'),
                getStat(homeStats, 'steals') - getStat(awayStats, 'steals'),
                getStat(homeStats, 'stealsperGame') - getStat(awayStats, 'stealsperGame'),
                getStat(homeStats, 'effectiveFieldGoalPct') - getStat(awayStats, 'effectiveFieldGoalPct'),
                getStat(homeStats, 'freeThrowPct') - getStat(awayStats, 'freeThrowPct'),
                getStat(homeStats, 'totalTurnovers') - getStat(awayStats, 'totalTurnovers'),
                getStat(homeStats, 'averageTurnovers') - getStat(awayStats, 'averageTurnovers'),
                getStat(homeStats, 'threePointPct') - getStat(awayStats, 'threePointPct'),
                getStat(homeStats, 'trueShootingPct') - getStat(awayStats, 'trueShootingPct'),
                getStat(homeStats, 'turnoverRatio') - getStat(awayStats, 'turnoverRatio'),
                getStat(homeStats, 'assisttoTurnoverRatio') - getStat(awayStats, 'assisttoTurnoverRatio'),
                getStat(homeStats, 'pointsinPaint') - getStat(awayStats, 'pointsinPaint'),
                getStat(homeStats, 'pace') - getStat(awayStats, 'pace'),
            ];
        default:
            return [];
    }
}
// Define the utility functions above your existing code
async function extractSportWeights(model, sportName) {
    let weights, weightMatrix, averages = [];

    // Extract weights from the first (input) layer of the model
    weights = model.layers[0].getWeights();
    weightMatrix = await weights[0].array(); // This gives the matrix of weights for each feature

    // Sum weights for each feature (column-wise)
    matrixIterator(weightMatrix, averages);

    // Return the averages array specific to the sport
    return averages;
}

function matrixIterator(weightMatrix, averages) {
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

async function handleSportWeights(model, sport) {
    let sportWeights;

    switch (sport.name) {
        case 'americanfootball_nfl':
            sportWeights = await extractSportWeights(model, 'americanfootball_nfl');
            nflWeights = sportWeights;
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
const sports = [
    {
        name: "americanfootball_nfl",
        espnSport: 'football',
        league: 'nfl',
        startMonth: 9,
        endMonth: 2,
        multiYear: true,
        statYear: 2024,
        decayFactor: 0.95
    },
    {
        name: "americanfootball_ncaaf",
        espnSport: 'football',
        league: 'college-football',
        startMonth: 9,
        endMonth: 1,
        multiYear: true,
        statYear: 2024,
        decayFactor: 0.90
    },
    {
        name: "basketball_nba",
        espnSport: 'basketball',
        league: 'nba',
        startMonth: 10,
        endMonth: 4,
        multiYear: true,
        statYear: 2025,
        decayFactor: 0.85
    },
    {
        name: "icehockey_nhl",
        espnSport: 'hockey',
        league: 'nhl',
        startMonth: 10,
        endMonth: 4,
        multiYear: true,
        statYear: 2025,
        prevstatYear: 2024,
        decayFactor: 0.85
    },
    {
        name: "baseball_mlb",
        espnSport: 'baseball',
        league: 'mlb',
        startMonth: 3,
        endMonth: 10,
        multiYear: false,
        statYear: 2024,
        decayFactor: 0.75
    }, {
        name: "basketball_ncaab",
        espnSport: 'basketball',
        league: 'mens-college-basketball',
        startMonth: 11,
        endMonth: 4,
        multiYear: true,
        statYear: 2025,
        decayFactor: 0.85
    },
    {
        name: "basketball_wncaab",
        espnSport: 'basketball',
        league: 'womens-college-basketball',
        startMonth: 11,
        endMonth: 4,
        multiYear: true,
        statYear: 2025,
        decayFactor: 0.85
    },
]
const mlModelTraining = async (gameData, xs, ys, sport) => {
    gameData.forEach(game => {
        const homeStats = game.homeTeamStats;
        const awayStats = game.awayTeamStats;

        // Extract features based on sport
        const features = extractSportFeatures(homeStats, awayStats, sport.name);

        // Set label to 1 if home team wins, 0 if away team wins
        const correctPrediction = game.winner = 'home' ? 1 : 0;

        xs.push(features);
        ys.push(correctPrediction);
    });
    // Convert arrays to tensors
    const xsTensor = tf.tensor2d(xs);
    const ysTensor = tf.tensor2d(ys, [ys.length, 1]);
    // Define the path to the model
    const modelPath = `./model_checkpoint/${sport.name}_model/model.json`;
    // Define the path to the model directory
    const modelDir = `./model_checkpoint/${sport.name}_model`;

    // Define the model
    const loadOrCreateModel = async () => {
        try {
            if (fs.existsSync(modelPath)) {
                return await tf.loadLayersModel(`file://./model_checkpoint/${sport.name}_model/model.json`);
            } else {
                let newModel = tf.sequential();

                newModel.add(tf.layers.dense({ units: 64, inputShape: [xs[0].length], activation: 'relu', kernelInitializer: 'glorotUniform', biasInitializer: 'zeros' }));
                newModel.add(tf.layers.dense({ units: xs[0].length * 2, activation: 'relu', kernelInitializer: 'glorotUniform', biasInitializer: 'zeros' }));
                newModel.add(tf.layers.dense({ units: xs[0].length * 2, activation: 'relu', kernelInitializer: 'glorotUniform', biasInitializer: 'zeros' }));
                newModel.add(tf.layers.dense({ units: 1, activation: 'sigmoid', kernelInitializer: 'glorotUniform', biasInitializer: 'zeros' }));

                // Compile the model

                return newModel
            }
        } catch (err) {
            console.log(err)
        }
    }
    const model = await loadOrCreateModel()
    model.compile({
        optimizer: tf.train.adam(.01),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy']
    });
    const earlyStopping = tf.callbacks.earlyStopping({
        monitor: 'val_loss',
        patience: 25,
    });
    // Train the model
    await model.fit(xsTensor, ysTensor, {
        epochs: 100,
        batchSize: xs.length < 32 ? xs.length : 32,
        validationSplit: 0.3,
        shuffle: false,
        verbose: false
    });
    if (!fs.existsSync(modelDir)) {
        console.log('Creating model directory...');
        // Create the directory (including any necessary parent directories)
        fs.mkdirSync(modelDir, { recursive: true });
    }
    // Save model specific to the sport
    await model.save(`file://./model_checkpoint/${sport.name}_model`);
    return { model, xsTensor, ysTensor }
    // Log loss and accuracy
}
const predictions = async (sportOdds, ff, model) => {
    if (sportOdds.length > 0) {
        sportOdds.forEach(game => {
            if (game.homeTeamStats && game.awayTeamStats) {
                const homeStats = game.homeTeamStats;
                const awayStats = game.awayTeamStats;



                // Extract features based on sport
                const features = extractSportFeatures(homeStats, awayStats, game.sport_key);


                ff.push(features);
            }

        });
        const ffTensor = tf.tensor2d(ff);
        // Get predictions as a promise and wait for it to resolve
        const predictions = await model.predict(ffTensor);
        // Convert tensor to an array of predicted probabilities
        const probabilities = await predictions.array();  // This resolves the tensor to an array
        // sportOdds.forEach(async (game, index) => {
        //     if (!game.awayTeamStats && !game.homeTeamStats) {

        //     } else {
        //         const predictedWinPercent = probabilities[index][0]; // Get the probability for the current game
        //         // Update the game with the predicted win percentage
        //         await Odds.findOneAndUpdate({ id: game.id }, { winPercent: predictedWinPercent });
        //     }

        // });
    }
}
//DETERMINE H2H INDEXES FOR EVERY GAME IN ODDS
// Helper function to adjust indexes for football games
function adjustnflStats(homeTeam, awayTeam, homeIndex, awayIndex) {
    homeTeam.seasonWinLoss.split("-")[0] >= awayTeam.seasonWinLoss.split("-")[0] ? homeIndex += nflWeights[0] : awayIndex += nflWeights[0];
    homeTeam.homeWinLoss.split("-")[0] >= awayTeam.awayWinLoss.split("-")[0] ? homeIndex += nflWeights[1] : awayIndex += nflWeights[1];
    homeTeam.pointDiff >= awayTeam.pointDiff ? homeIndex += nflWeights[2] : awayIndex += nflWeights[2];
    let nflWeightIndex = 3
    const reverseComparisonStats = ['totalPenyards', 'averagePenYardsPerGame', 'interceptions', 'giveaways'];
    // Loop through homeTeam.stats to compare each stat
    for (const stat in homeTeam.stats) {
        if (homeTeam.stats.hasOwnProperty(stat)) {
            const homeStat = homeTeam.stats[stat];
            const awayStat = awayTeam.stats[stat];

            // Check if the stat is one that requires reversed comparison
            if (reverseComparisonStats.includes(stat)) {
                // For reversed comparison, check if homeStat is less than or equal to awayStat
                if (homeStat <= awayStat) {
                    homeIndex += nflWeights[nflWeightIndex];
                } else {
                    awayIndex += nflWeights[nflWeightIndex];
                }
            } else {
                // For all other stats, check if homeStat is greater than or equal to awayStat
                if (homeStat >= awayStat) {
                    homeIndex += nflWeights[nflWeightIndex];
                } else {
                    awayIndex += nflWeights[nflWeightIndex];
                }
            }
        }
        nflWeightIndex++
    }

    return { homeIndex, awayIndex };
}
function adjustncaafStats(homeTeam, awayTeam, homeIndex, awayIndex) {
    homeTeam.seasonWinLoss.split("-")[0] >= awayTeam.seasonWinLoss.split("-")[0] ? homeIndex += ncaafWeights[0] : awayIndex += ncaafWeights[0];
    homeTeam.homeWinLoss.split("-")[0] >= awayTeam.awayWinLoss.split("-")[0] ? homeIndex += ncaafWeights[1] : awayIndex += ncaafWeights[1];
    homeTeam.pointDiff >= awayTeam.pointDiff ? homeIndex += ncaafWeights[2] : awayIndex += ncaafWeights[2];
    let ncaafWeightIndex = 3
    const reverseComparisonStats = ['totalPenyards', 'averagePenYardsPerGame', 'interceptions', 'giveaways'];
    // Loop through homeTeam.stats to compare each stat
    for (const stat in homeTeam.stats) {
        if (homeTeam.stats.hasOwnProperty(stat)) {
            const homeStat = homeTeam.stats[stat];
            const awayStat = awayTeam.stats[stat];

            // Check if the stat is one that requires reversed comparison
            if (reverseComparisonStats.includes(stat)) {
                // For reversed comparison, check if homeStat is less than or equal to awayStat
                if (homeStat <= awayStat) {
                    homeIndex += ncaafWeights[ncaafWeightIndex];
                } else {
                    awayIndex += ncaafWeights[ncaafWeightIndex];
                }
            } else {
                // For all other stats, check if homeStat is greater than or equal to awayStat
                if (homeStat >= awayStat) {
                    homeIndex += ncaafWeights[ncaafWeightIndex];
                } else {
                    awayIndex += ncaafWeights[ncaafWeightIndex];
                }
            }
        }
        ncaafWeightIndex++
    }
    return { homeIndex, awayIndex };
}
// Helper function to adjust indexes for hockey games
function adjustnhlStats(homeTeam, awayTeam, homeIndex, awayIndex) {
    homeTeam.seasonWinLoss.split("-")[0] >= awayTeam.seasonWinLoss.split("-")[0] ? homeIndex += nhlWeights[0] : awayIndex += nhlWeights[0];
    homeTeam.homeWinLoss.split("-")[0] >= awayTeam.awayWinLoss.split("-")[0] ? homeIndex += nhlWeights[1] : awayIndex += nhlWeights[1];
    homeTeam.pointDiff >= awayTeam.pointDiff ? homeIndex += nhlWeights[2] : awayIndex += nhlWeights[2];
    let nhlWeightIndex = 3
    const reverseComparisonStats = ['totalPenyards', 'goalsAgainstAverage', 'shotsAgainst', 'shotsAgainstPerGame', 'giveaways'];
    // Loop through homeTeam.stats to goalsAgainst each stat
    for (const stat in homeTeam.stats) {
        if (homeTeam.stats.hasOwnProperty(stat)) {
            const homeStat = homeTeam.stats[stat];
            const awayStat = awayTeam.stats[stat];

            // Check if the stat is one that requires reversed comparison
            if (reverseComparisonStats.includes(stat)) {
                // For reversed comparison, check if homeStat is less than or equal to awayStat
                if (homeStat <= awayStat) {
                    homeIndex += nhlWeights[nhlWeightIndex];
                } else {
                    awayIndex += nhlWeights[nhlWeightIndex];
                }
            } else {
                // For all other stats, check if homeStat is greater than or equal to awayStat
                if (homeStat >= awayStat) {
                    homeIndex += nhlWeights[nhlWeightIndex];
                } else {
                    awayIndex += nhlWeights[nhlWeightIndex];
                }
            }
        }
        nhlWeightIndex++
    }


    return { homeIndex, awayIndex };
}
// Helper function to adjust indexes for basketball games
function adjustnbaStats(homeTeam, awayTeam, homeIndex, awayIndex) {
    homeTeam.seasonWinLoss.split("-")[0] >= awayTeam.seasonWinLoss.split("-")[0] ? homeIndex += nbaWeights[0] : awayIndex += nbaWeights[0];
    homeTeam.homeWinLoss.split("-")[0] >= awayTeam.awayWinLoss.split("-")[0] ? homeIndex += nbaWeights[1] : awayIndex += nbaWeights[1];
    homeTeam.pointDiff >= awayTeam.pointDiff ? homeIndex += nbaWeights[2] : awayIndex += nbaWeights[2];
    let nbaWeightIndex = 3
    const reverseComparisonStats = ['averageTurnovers', 'totalTurnovers'];
    // Loop through homeTeam.stats to goalsAgainst each stat

    for (const stat in homeTeam.stats) {
        if (stat === 'fieldGoalMakesPerAttempts' || stat === 'freeThrowsMadePerAttempts') {

        } else {
            if (homeTeam.stats.hasOwnProperty(stat)) {
                const homeStat = homeTeam.stats[stat];
                const awayStat = awayTeam.stats[stat];

                // Check if the stat is one that requires reversed comparison
                if (reverseComparisonStats.includes(stat)) {
                    // For reversed comparison, check if homeStat is less than or equal to awayStat
                    if ((typeof homeStat === 'number' && !isNaN(homeStat)) && (typeof awayStat === 'number' && !isNaN(awayStat))) {
                        if (homeStat <= awayStat) {
                            homeIndex += nbaWeights[nbaWeightIndex];
                        } else {
                            awayIndex += nbaWeights[nbaWeightIndex];
                        }
                        nbaWeightIndex++
                    }

                } else {
                    if ((typeof homeStat === 'number' && !isNaN(homeStat)) && (typeof awayStat === 'number' && !isNaN(awayStat))) {
                        if (homeStat >= awayStat) {
                            homeIndex += nbaWeights[nbaWeightIndex];
                        } else {
                            awayIndex += nbaWeights[nbaWeightIndex];
                        }
                        nbaWeightIndex++
                    }
                    // For all other stats, check if homeStat is greater than or equal to awayStat

                }

            }

        }

    }


    return { homeIndex, awayIndex };
}
// Helper function to adjust indexes for baseball games
function adjustmlbStats(homeTeam, awayTeam, homeIndex, awayIndex) {
    homeTeam.seasonWinLoss.split("-")[0] >= awayTeam.seasonWinLoss.split("-")[0] ? homeIndex += mlbWeights[0] : awayIndex += mlbWeights[0];
    homeTeam.homeWinLoss.split("-")[0] >= awayTeam.awayWinLoss.split("-")[0] ? homeIndex += mlbWeights[1] : awayIndex += mlbWeights[1];
    homeTeam.pointDiff >= awayTeam.pointDiff ? homeIndex += mlbWeights[2] : awayIndex += mlbWeights[2];
    let mlbWeightIndex = 3
    const reverseComparisonStats = ['fieldingErrors', 'oppOPS', 'oppSlugging', 'oppBattingAverage', 'walksHitsPerInningPitched', 'earnedRunAverage', 'walksPitchingTotal'];
    // Loop through homeTeam.stats to goalsAgainst each stat
    for (const stat in homeTeam.stats) {
        if (homeTeam.stats.hasOwnProperty(stat)) {
            const homeStat = homeTeam.stats[stat];
            const awayStat = awayTeam.stats[stat];

            // Check if the stat is one that requires reversed comparison
            if (reverseComparisonStats.includes(stat)) {
                // For reversed comparison, check if homeStat is less than or equal to awayStat
                if (homeStat <= awayStat) {
                    homeIndex += mlbWeights[mlbWeightIndex];
                } else {
                    awayIndex += mlbWeights[mlbWeightIndex];
                }
            } else {
                // For all other stats, check if homeStat is greater than or equal to awayStat
                if (homeStat >= awayStat) {
                    homeIndex += mlbWeights[mlbWeightIndex];
                } else {
                    awayIndex += mlbWeights[mlbWeightIndex];
                }
            }
        }
        mlbWeightIndex++
    }

    return { homeIndex, awayIndex };
}
function adjustncaamStats(homeTeam, awayTeam, homeIndex, awayIndex) {

    homeTeam?.seasonWinLoss?.split("-")[0] >= awayTeam?.seasonWinLoss?.split("-")[0] ? homeIndex += ncaamWeights[0] : awayIndex += ncaamWeights[0];
    homeTeam?.homeWinLoss?.split("-")[0] >= awayTeam.awayWinLoss.split("-")[0] ? homeIndex += ncaamWeights[1] : awayIndex += ncaamWeights[1];
    homeTeam?.pointDiff >= awayTeam?.pointDiff ? homeIndex += ncaamWeights[2] : awayIndex += ncaamWeights[2];
    let ncaamWeightIndex = 3
    const reverseComparisonStats = ['averageTurnovers', 'totalTurnovers'];
    // Loop through homeTeam.stats to goalsAgainst each stat
    for (const stat in homeTeam.stats) {
        if (stat === 'fieldGoalMakesPerAttempts' || stat === 'freeThrowsMadePerAttempts') {

        } else {
            if (homeTeam.stats.hasOwnProperty(stat)) {
                const homeStat = homeTeam.stats[stat];
                const awayStat = awayTeam.stats[stat];

                // Check if the stat is one that requires reversed comparison
                if (reverseComparisonStats.includes(stat)) {
                    // For reversed comparison, check if homeStat is less than or equal to awayStat
                    if ((typeof homeStat === 'number' && !isNaN(homeStat)) && (typeof awayStat === 'number' && !isNaN(awayStat))) {
                        if (homeStat <= awayStat) {
                            homeIndex += ncaamWeights[ncaamWeightIndex];
                        } else {
                            awayIndex += ncaamWeights[ncaamWeightIndex];
                        }
                        ncaamWeightIndex++
                    }

                } else {
                    if ((typeof homeStat === 'number' && !isNaN(homeStat)) && (typeof awayStat === 'number' && !isNaN(awayStat))) {
                        if (homeStat >= awayStat) {
                            homeIndex += ncaamWeights[ncaamWeightIndex];
                        } else {
                            awayIndex += ncaamWeights[ncaamWeightIndex];
                        }
                        ncaamWeightIndex++
                    }

                }

            }
        }

    }

    return { homeIndex, awayIndex };
}
function adjustwncaabStats(homeTeam, awayTeam, homeIndex, awayIndex) {
    homeTeam.seasonWinLoss.split("-")[0] >= awayTeam.seasonWinLoss.split("-")[0] ? homeIndex += ncaawWeights[0] : awayIndex += ncaawWeights[0];
    homeTeam.homeWinLoss.split("-")[0] >= awayTeam.awayWinLoss.split("-")[0] ? homeIndex += ncaawWeights[1] : awayIndex += ncaawWeights[1];
    homeTeam.pointDiff >= awayTeam.pointDiff ? homeIndex += ncaawWeights[2] : awayIndex += ncaawWeights[2];
    let ncaawWeightIndex = 3
    const reverseComparisonStats = ['averageTurnovers', 'totalTurnovers'];
    // Loop through homeTeam.stats to goalsAgainst each stat
    for (const stat in homeTeam.stats) {
        if (stat === 'fieldGoalMakesPerAttempts' || stat === 'freeThrowsMadePerAttempts') {

        } else {
            if (homeTeam.stats.hasOwnProperty(stat)) {
                const homeStat = homeTeam.stats[stat];
                const awayStat = awayTeam.stats[stat];

                // Check if the stat is one that requires reversed comparison
                if (reverseComparisonStats.includes(stat)) {
                    // For reversed comparison, check if homeStat is less than or equal to awayStat
                    if ((typeof homeStat === 'number' && !isNaN(homeStat)) && (typeof awayStat === 'number' && !isNaN(awayStat))) {
                        if (homeStat <= awayStat) {
                            homeIndex += ncaawWeights[ncaawWeightIndex];
                        } else {
                            awayIndex += ncaawWeights[ncaawWeightIndex];
                        }
                        ncaawWeightIndex++
                    }

                } else {
                    if ((typeof homeStat === 'number' && !isNaN(homeStat)) && (typeof awayStat === 'number' && !isNaN(awayStat))) {
                        if (homeStat >= awayStat) {
                            homeIndex += ncaawWeights[ncaawWeightIndex];
                        } else {
                            awayIndex += ncaawWeights[ncaawWeightIndex];
                        }
                        ncaawWeightIndex++
                    }

                }

            }
        }

    }

    return { homeIndex, awayIndex };
}
const indexAdjuster = (currentOdds, sport) => {
    currentOdds.map(async (game, index) => {
        // Check if the game is in the future
        if (moment().isBefore(moment(game.commence_time))) {
            let homeTeamList = [];
            let awayTeamList = [];
            let homeTeam;
            let awayTeam;

            // Fetch team data based on sport
            if (game.sport === 'football') {
                homeTeamList = await UsaFootballTeam.find({ 'espnDisplayName': game.home_team });
                awayTeamList = await UsaFootballTeam.find({ 'espnDisplayName': game.away_team });
            } else if (game.sport === 'baseball') {
                homeTeamList = await BaseballTeam.find({ 'espnDisplayName': game.home_team });
                awayTeamList = await BaseballTeam.find({ 'espnDisplayName': game.away_team });
            } else if (game.sport === 'basketball') {
                homeTeamList = await BasketballTeam.find({ 'espnDisplayName': game.home_team });
                awayTeamList = await BasketballTeam.find({ 'espnDisplayName': game.away_team });
            } else if (game.sport === 'hockey') {
                homeTeamList = await HockeyTeam.find({ 'espnDisplayName': game.home_team });
                awayTeamList = await HockeyTeam.find({ 'espnDisplayName': game.away_team });
            }

            // Function to find a team based on schedule date
            async function findTeamSchedule(teamList, teamType) {
                if (teamList.length > 1) {
                    // Loop through teams if there are multiple
                    for (let idx = 0; idx < teamList.length; idx++) {
                        let team = teamList[idx];
                        try {
                            // Fetch team schedule from ESPN API
                            let scheduleResponse = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${game.sport}/${team.league}/teams/${team.espnID}/schedule`);
                            let scheduleJSON = await scheduleResponse.json();

                            // Loop through events in the team's schedule
                            for (let event of scheduleJSON.events) {
                                // Check if the event matches the current game's date
                                if (moment(event.date).isSame(moment(game.commence_time), 'hour')) {
                                    if (teamType === 'home') {
                                        homeTeam = teamList[idx];
                                    } else if (teamType === 'away') {
                                        awayTeam = teamList[idx];
                                    }
                                }
                            }
                        } catch (error) {
                            console.error(`Error fetching schedule for ${team.espnDisplayName}:`, error);
                        }
                    }
                } else if (teamList.length === 1) {
                    // If only one team is found, assign it directly
                    if (teamType === 'home') {
                        homeTeam = teamList[0];
                    } else if (teamType === 'away') {
                        awayTeam = teamList[0];
                    }
                } else if (teamList.length === 0) {
                    console.log(game.id)
                    // if (game.id === '386b527dff39523d361ab43df5a85a5a') {
                    //     await Odds.deleteOne({ id: game.id });
                    // }

                }
            }

            // Call the function to check home and away teams
            await findTeamSchedule(homeTeamList, 'home');
            await findTeamSchedule(awayTeamList, 'away');

            let homeIndex = 0;
            let awayIndex = 0;
            if (homeTeam && awayTeam && homeTeam.stats && awayTeam.stats && homeTeam.seasonWinLoss && awayTeam.seasonWinLoss) {
                // Sport-specific conditions
                if (game.sport_key === 'americanfootball_nfl') {
                    ({ homeIndex, awayIndex } = adjustnflStats(homeTeam, awayTeam, homeIndex, awayIndex));
                }
                else if (game.sport_key === 'americanfootball_ncaaf') {
                    ({ homeIndex, awayIndex } = adjustncaafStats(homeTeam, awayTeam, homeIndex, awayIndex));
                }
                else if (game.sport_key === 'icehockey_nhl') {
                    ({ homeIndex, awayIndex } = adjustnhlStats(homeTeam, awayTeam, homeIndex, awayIndex));
                }
                else if (game.sport_key === 'basketball_nba') {
                    ({ homeIndex, awayIndex } = adjustnbaStats(homeTeam, awayTeam, homeIndex, awayIndex));
                }
                else if (game.sport_key === 'baseball_mlb') {
                    ({ homeIndex, awayIndex } = adjustmlbStats(homeTeam, awayTeam, homeIndex, awayIndex));
                }
                else if (game.sport_key === 'basketball_ncaab') {
                    ({ homeIndex, awayIndex } = adjustncaamStats(homeTeam, awayTeam, homeIndex, awayIndex));

                }
                else if (game.sport_key === 'basketball_wncaab') {
                    ({ homeIndex, awayIndex } = adjustwncaabStats(homeTeam, awayTeam, homeIndex, awayIndex));
                }
            }
            const getCommonStats = (team) => ({
                seasonWinLoss: team.seasonWinLoss,
                homeWinLoss: team.homeWinLoss,
                awayWinLoss: team.awayWinLoss,
                pointDiff: team.pointDiff,
                pointsPerGame: team.stats.pointsPerGame,
                totalPoints: team.stats.totalPoints,
                totalFirstDowns: team.stats.totalFirstDowns,
                rushingFirstDowns: team.stats.rushingFirstDowns,
                passingFirstDowns: team.stats.passingFirstDowns,
                thirdDownEfficiency: team.stats.thirdDownEfficiency,
                netPassingYardsPerGame: team.stats.netPassingYardsPerGame,
                interceptions: team.stats.interceptions,
                completionPercent: team.stats.completionPercent,
                rushingYards: team.stats.rushingYards,
                rushingYardsPerGame: team.stats.rushingYardsPerGame,
                yardsPerRushAttempt: team.stats.yardsPerRushAttempt,
                yardsPerGame: team.stats.yardsPerGame,
                fGgoodPct: team.stats.fGgoodPct,
                touchBackPercentage: team.stats.touchBackPercentage,
                totalPenyards: team.stats.totalPenyards,
                averagePenYardsPerGame: team.stats.averagePenYardsPerGame,
                giveaways: team.stats.giveaways,
                takeaways: team.stats.takeaways,
                turnoverDiff: team.stats.turnoverDiff,
                sacksTotal: team.stats.sacksTotal,
                sacksPerGame: team.stats.sacksPerGame,
                yardsLostPerSack: team.stats.yardsLostPerSack,
                passesDefended: team.stats.passesDefended,
                passesDefendedPerGame: team.stats.passesDefendedPerGame,
                tacklesforLoss: team.stats.tacklesforLoss,
                tacklesforLossPerGame: team.stats.tacklesforLossPerGame,
                strikeoutsTotal: team.stats.strikeoutsTotal,
                rBIsTotal: team.stats.rBIsTotal,
                hitsTotal: team.stats.hitsTotal,
                stolenBasesTotal: team.stats.stolenBasesTotal,
                walksTotal: team.stats.walksTotal,
                runsTotal: team.stats.runsTotal,
                homeRunsTotal: team.stats.homeRunsTotal,
                totalBases: team.stats.totalBases,
                extraBaseHitsTotal: team.stats.extraBaseHitsTotal,
                battingAverageTotal: team.stats.battingAverageTotal,
                sluggingPercentage: team.stats.sluggingPercentage,
                onBasePercent: team.stats.onBasePercent,
                onBasePlusSlugging: team.stats.onBasePlusSlugging,
                stolenBasePct: team.stats.stolenBasePct,
                walkToStrikeoutRatio: team.stats.walkToStrikeoutRatio,
                saves: team.stats.saves,
                strikeoutsPitchingTotal: team.stats.strikeoutsPitchingTotal,
                walksPitchingTotal: team.stats.walksPitchingTotal,
                qualityStarts: team.stats.qualityStarts,
                earnedRunAverage: team.stats.earnedRunAverage,
                walksHitsPerInningPitched: team.stats.walksHitsPerInningPitched,
                groundToFlyRatio: team.stats.groundToFlyRatio,
                runSupportAverage: team.stats.runSupportAverage,
                oppBattingAverage: team.stats.oppBattingAverage,
                oppSlugging: team.stats.oppSlugging,
                oppOPS: team.stats.oppOPS,
                savePct: team.stats.savePct,
                strikeoutPerNine: team.stats.strikeoutPerNine,
                strikeoutToWalkRatioPitcher: team.stats.strikeoutToWalkRatioPitcher,
                doublePlays: team.stats.doublePlays,
                fieldingErrors: team.stats.fieldingErrors,
                fieldingPercentage: team.stats.fieldingPercentage,
                ReboundsTotal: team.stats.ReboundsTotal,
                PointsTotal: team.stats.PointsTotal,
                pointsPergame: team.stats.pointsPergame,
                blocksTotal: team.stats.blocksTotal,
                blocksPerGame: team.stats.blocksPerGame,
                defensiveRebounds: team.stats.defensiveRebounds,
                defensiveReboundsperGame: team.stats.defensiveReboundsperGame,
                offensiveRebounds: team.stats.offensiveRebounds,
                offensiveReboundsperGame: team.stats.offensiveReboundsperGame,
                steals: team.stats.steals,
                stealsperGame: team.stats.stealsperGame,
                effectiveFieldGoalPct: team.stats.effectiveFieldGoalPct,
                fieldGoalMakesperAttempts: team.stats.fieldGoalMakesperAttempts,
                freeThrowsMadeperAttemps: team.stats.freeThrowsMadeperAttemps,
                freeThrowPct: team.stats.freeThrowPct,
                totalTurnovers: team.stats.totalTurnovers,
                averageTurnovers: team.stats.averageTurnovers,
                threePointPct: team.stats.threePointPct,
                trueShootingPct: team.stats.trueShootingPct,
                turnoverRatio: team.stats.turnoverRatio,
                assisttoTurnoverRatio: team.stats.assisttoTurnoverRatio,
                pointsinPaint: team.stats.pointsinPaint,
                pace: team.stats.pace,
                goals: team.stats.goals,
                goalsPerGame: team.stats.goalsPerGame,
                assists: team.stats.assists,
                assistsPerGame: team.stats.assistsPerGame,
                totalShotsTaken: team.stats.totalShotsTaken,
                shotsTakenPerGame: team.stats.shotsTakenPerGame,
                powerPlayGoals: team.stats.powerPlayGoals,
                powerPlayGoalsPerGame: team.stats.powerPlayGoalsPerGame,
                powerPlayPct: team.stats.powerPlayPct,
                shootingPct: team.stats.shootingPct,
                faceoffsWon: team.stats.faceoffsWon,
                faceoffsWonPerGame: team.stats.faceoffsWonPerGame,
                faceoffPercent: team.stats.faceoffPercent,
                giveaways: team.stats.giveaways,
                penaltyMinutes: team.stats.penaltyMinutes,
                penaltyMinutesPerGame: team.stats.penaltyMinutesPerGame,
                goalsAgainst: team.stats.goalsAgainst,
                goalsAgainstAverage: team.stats.goalsAgainstAverage,
                shotsAgainst: team.stats.shotsAgainst,
                shotsAgainstPerGame: team.stats.shotsAgainstPerGame,
                shotsBlocked: team.stats.shotsBlocked,
                shotsBlockedPerGame: team.stats.shotsBlockedPerGame,
                penaltyKillPct: team.stats.penaltyKillPct,
                totalSaves: team.stats.totalSaves,
                savePerGame: team.stats.savePerGame,
                savePct: team.stats.savePct,
                takeaways: team.stats.takeaways,
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
            // Update the Odds database with the calculated indices
            if (sport.name === game.sport_key) {
                await Odds.findOneAndUpdate({ 'id': game.id }, {
                    homeTeamIndex: homeIndex * 10 || 0,
                    awayTeamIndex: awayIndex * 10 || 0,
                    homeTeamStats: homeTeam ? cleanStats(getCommonStats(homeTeam)) : 'no stat data',
                    awayTeamStats: awayTeam ? cleanStats(getCommonStats(awayTeam)) : 'no stat data',
                    homeTeamlogo: homeTeam ? homeTeam.logo : 'no logo data',
                    awayTeamlogo: awayTeam ? awayTeam.logo : 'no logo data',
                    homeTeamAbbr: homeTeam?.abbreviation,
                    awayTeamAbbr: awayTeam?.abbreviation
                });
            }
        }
    });
}
const normalizeTeamName = (teamName, league) => {
    const knownTeamNames = {
        "SE Missouri State Redhawks": "Southeast Missouri State Redhawks",
        "Arkansas-Little Rock Trojans": "Little Rock Trojans"
    }



    if (league === 'basketball_ncaab') {
        // Replace common abbreviations or patterns
        teamName = teamName.replace(/\bst\b(?!\.)/gi, 'State'); // Match "St" or "st" as a separate word, not followed by a perio
    }

    if (knownTeamNames[teamName]) {
        teamName = knownTeamNames[teamName];
    }

    // // Replace hyphens with spaces
    // teamName = teamName.replace(/-/g, ' '); // Replace all hyphens with spaces

    // // Remove all punctuation and extra spaces
    // teamName = teamName.replace(/[^\w\s&]/g, ''); // Removes non-alphanumeric characters except spaces and ampersands
    // teamName = teamName.replace(/\s+/g, ' ').trim(); // Remove extra spaces and trim leading/trailing spaces

    return teamName;
}






const oddsSeed = async () => {
    // RETRIEVE ODDS
    console.log('BEGINNING ODDS SEEDING')
    await axios.all(sports.filter(sport => {
        const { startMonth, endMonth, multiYear } = sport;

        // Multi-year sports have a range that spans over the calendar year
        if (multiYear) {
            // Check if current month is within the range
            if (startMonth <= moment().month() + 1 || moment().month() + 1 <= endMonth) {
                return true;
            }
        } else {
            // Single-year sports are only valid in their specific month range
            if (moment().month() + 1 >= startMonth && moment().month() + 1 <= endMonth) {
                return true;
            }
        }
        return false;
    }).map((sport) =>
        axios.get(`https://api.the-odds-api.com/v4/sports/${sport.name}/odds/?apiKey=${process.env.ODDS_KEY_SMOKEY}&regions=us&oddsFormat=american&markets=h2h`)
    )).then(async (data) => {
        try {
            data.map(async (item) => {
                item.data.map(async (event) => {
                    if (moment().isBefore(moment(event.commence_time))) {


                        // Normalize the team names in outcomes (used for the 'name' field)
                        const normalizeOutcomes = (outcomes, league) => {
                            return outcomes.map(outcome => ({
                                ...outcome,
                                name: normalizeTeamName(outcome.name, league) // Normalize the outcome team name
                            }));
                        };

                        let oddExist = await Odds.findOne({ id: event.id });

                        // Normalize team names for home and away teams
                        const normalizedHomeTeam = normalizeTeamName(event.home_team, event.sport_key);
                        const normalizedAwayTeam = normalizeTeamName(event.away_team, event.sport_key);

                        // Normalize the outcomes (nested inside bookmakers -> markets -> outcomes)
                        const updatedBookmakers = event.bookmakers.map(bookmaker => ({
                            ...bookmaker,
                            markets: bookmaker.markets.map(market => ({
                                ...market,
                                outcomes: normalizeOutcomes(market.outcomes, event.sport_key) // Normalize outcomes names
                            }))
                        }));

                        // Use the sport_key to determine the sport type for the odds
                        let sportType = '';

                        if (event.sport_key === 'americanfootball_nfl' || event.sport_key === 'americanfootball_ncaaf') {
                            sportType = 'football';
                        } else if (event.sport_key === 'basketball_nba' || event.sport_key === 'basketball_ncaab' || event.sport_key === 'basketball_wncaab') {
                            sportType = 'basketball';
                        } else if (event.sport_key === 'icehockey_nhl') {
                            sportType = 'hockey';
                        } else if (event.sport_key === 'baseball_mlb') {
                            sportType = 'baseball';
                        }



                        if (!event.sport_key) {
                            console.error(`sportType is undefined for event: ${event.id}`);
                        } else {
                            if (oddExist) {
                                // Update the existing odds with normalized team names and sport type
                                await Odds.findOneAndUpdate({ id: event.id }, {
                                    ...event,
                                    home_team: normalizedHomeTeam,
                                    away_team: normalizedAwayTeam,
                                    bookmakers: updatedBookmakers, // Include the updated bookmakers with normalized outcomes
                                    sport: sportType,
                                });
                            } else {
                                // Create a new odds entry with normalized team names and sport type
                                await Odds.create({
                                    ...event,
                                    home_team: normalizedHomeTeam,
                                    away_team: normalizedAwayTeam,
                                    bookmakers: updatedBookmakers, // Include the updated bookmakers with normalized outcomes
                                    sport: sportType,
                                });
                            }
                        }



                        // let oddExist = await Odds.findOne({ id: event.id })

                        // const normalizedHomeTeam = normalizeTeamName(event.home_team, event.sport_key)
                        // const normalizedAwayTeam = normalizeTeamName(event.away_team, event.sport_key)

                        // if (event.sport_key === 'americanfootball_nfl') {
                        //     if (oddExist) {
                        //         await Odds.findOneAndUpdate({ id: event.id }, {
                        //             ...event,
                        //             home_team: normalizedHomeTeam ,
                        //             away_team: normalizedAwayTeam ,
                        //             sport: 'football',

                        //         })

                        //     } else {
                        //         await Odds.create({
                        //             ...event,
                        //             home_team: normalizedHomeTeam ,
                        //             away_team: normalizedAwayTeam ,
                        //             sport: 'football',

                        //         })
                        //     }
                        // } else if (event.sport_key === 'americanfootball_ncaaf') {
                        //     if (oddExist) {
                        //         await Odds.findOneAndUpdate({ id: event.id }, {
                        //             ...event,
                        //             home_team: normalizedHomeTeam ,
                        //             away_team: normalizedAwayTeam ,
                        //             sport: 'football',

                        //         })

                        //     } else {
                        //         await Odds.create({
                        //             ...event,
                        //             home_team: normalizedHomeTeam ,
                        //             away_team: normalizedAwayTeam ,
                        //             sport: 'football',

                        //         })
                        //     }
                        // } else if (event.sport_key === 'basketball_nba') {
                        //     if (oddExist) {
                        //         await Odds.findOneAndUpdate({ id: event.id }, {
                        //             ...event,
                        //             home_team: normalizedHomeTeam ,
                        //             away_team: normalizedAwayTeam ,
                        //             sport: 'basketball',

                        //         })

                        //     } else {
                        //         await Odds.create({
                        //             ...event,
                        //             home_team: normalizedHomeTeam ,
                        //             away_team: normalizedAwayTeam ,
                        //             sport: 'basketball',

                        //         })

                        //     }
                        // } else if (event.sport_key === 'icehockey_nhl') {
                        //     if (oddExist) {
                        //         await Odds.findOneAndUpdate({ id: event.id }, {
                        //             ...event,
                        //             home_team: normalizedHomeTeam ,
                        //             away_team: normalizedAwayTeam ,
                        //             sport: 'hockey',

                        //         })
                        //     } else {
                        //         await Odds.create({
                        //             ...event,
                        //             home_team: normalizedHomeTeam ,
                        //             away_team: normalizedAwayTeam ,
                        //             sport: 'hockey',

                        //         })
                        //     }
                        // } else if (event.sport_key === 'baseball_mlb') {
                        //     if (oddExist) {
                        //         await Odds.findOneAndUpdate({ id: event.id }, {
                        //             ...event,
                        //             home_team: normalizedHomeTeam ,
                        //             away_team: normalizedAwayTeam ,
                        //             sport: 'baseball',

                        //         })

                        //     } else {
                        //         await Odds.create({
                        //             ...event,
                        //             home_team: normalizedHomeTeam ,
                        //             away_team: normalizedAwayTeam ,
                        //             sport: 'baseball',

                        //         })

                        //     }
                        // } else if (event.sport_key === 'basketball_ncaab') {
                        //     if (oddExist) {
                        //         await Odds.findOneAndUpdate({ id: event.id }, {
                        //             ...event,
                        //             home_team: normalizedHomeTeam ,
                        //             away_team: normalizedAwayTeam ,
                        //             sport: 'basketball',

                        //         })

                        //     } else {
                        //         await Odds.create({
                        //             ...event,
                        //             home_team: normalizedHomeTeam ,
                        //             away_team: normalizedAwayTeam ,
                        //             sport: 'basketball',

                        //         })

                        //     }
                        // }
                    }       //WRITE ODDS TO DB
                })
            })
            console.info('Odds Seeding complete! 🌱');
        } catch (err) {
            if (err) throw (err)
        }
    })
}
const removeSeed = async () => {
    currentOdds = await Odds.find();
    await removePastGames(currentOdds)

    currentOdds = await Odds.find();
    pastOdds = await PastGameOdds.find()

    await emitToClients('gameUpdate', currentOdds.sort((a, b) => {
        const timeA = new Date(a.commence_time).getTime();  // Round to the start of the minute
        const timeB = new Date(b.commence_time).getTime();  // Round to the start of the minute

        if (timeA === timeB) {
            return a.winPercent - b.winPercent;  // Sort by winPercent if times are the same
        } else {
            return timeA < timeB ? -1 : 1;  // Sort by commence_time otherwise
        }
    }));
    await emitToClients('pastGameUpdate', pastOdds.sort((a, b) => {
        const timeA = new Date(a.commence_time).getTime();  // Round to the start of the minute
        const timeB = new Date(b.commence_time).getTime();  // Round to the start of the minute

        if (timeA === timeB) {
            return a.winPercent - b.winPercent;  // Sort by winPercent if times are the same
        } else {
            return timeA < timeB ? 1 : -1;  // Sort by commence_time otherwise
        }
    }));
}
const dataSeed = async () => {

    console.log("DB CONNECTED ------------------------------------------------- STARTING SEED")
    await retrieveTeamsandStats()
    // DETERMINE TEAMS

    // CLEANED AND FORMATTED
    let currentOdds

    async function trainSportModel(sport, gameData) {
        currentOdds = await Odds.find({ sport_key: sport.name }) //USE THIS TO POPULATE UPCOMING GAME ODDS
        if (gameData.length < 5) {
            // Handle the case where there is no data for this sport
            console.log(`No data available for ${sport.league}. Skipping model training.`);
            // You could also add logic to handle this case more gracefully, 
            // such as logging the missing sport and providing a default model.
            return;
        }
        // Function to convert the game data into tensors
        const xs = []; // Features
        const ys = []; // Labels
        // Helper function to safely extract stats with fallback

        const { model, xsTensor, ysTensor } = await mlModelTraining(gameData, xs, ys, sport)



        // After model is trained and evaluated, integrate the weight extraction
        const evaluation = model.evaluate(xsTensor, ysTensor);
        const loss = evaluation[0].arraySync();
        const accuracy = evaluation[1].arraySync();

        if (accuracy < 1 || loss > 1) {
            console.log(`${sport.name} Model Loss:`, loss);
            console.log(`${sport.name} Model Accuracy:`, accuracy);
        }

        // Handle the weights extraction after training
        await handleSportWeights(model, sport);

        // Example of accessing the weights (e.g., after training)
        // Now you can access the weights for each sport like this:


        indexAdjuster(currentOdds, sport)

        let ff = []
        let sportOdds = await Odds.find({ sport_key: sport.name })
        predictions(sportOdds, ff, model)



    }
    for (sport = 0; sport < sports.length; sport++) {
        const pastGames = await PastGameOdds.find({ sport_key: sports[sport].name })
        await trainSportModel(sports[sport], pastGames)
    }
    console.log(`FINISHED TRAINING MODEL @ ${moment().format('HH:mm:ss')}`)

    currentOdds.map(async (game) => {
        try {
            // Loop over all bookmakers
            await Promise.all(game.bookmakers.map(async (bookmaker) => {
                // Loop over all markets for each bookmaker
                await Promise.all(bookmaker.markets.map(async (market) => {
                    // Loop over all outcomes for each market
                    await Promise.all(market.outcomes.map(async (outcome) => {
                        // Perform the update using arrayFilters to target the correct outcome
                        if (outcome.price < 0) {
                            await Odds.findOneAndUpdate(
                                { 'id': game.id }, // Filter by game id
                                {
                                    $set: {
                                        'bookmakers.$[bookmaker].markets.$[market].outcomes.$[outcome].impliedProb': Math.abs(outcome.price) / (Math.abs(outcome.price) + 100)
                                    }
                                },
                                {
                                    arrayFilters: [
                                        { 'bookmaker.key': bookmaker.key }, // Match bookmaker by key
                                        { 'market.key': market.key }, // Match market by key
                                        { 'outcome._id': outcome._id } // Match outcome by its _id
                                    ]
                                }
                            );
                        } else {
                            await Odds.findOneAndUpdate(
                                { 'id': game.id }, // Filter by game id
                                {
                                    $set: {
                                        'bookmakers.$[bookmaker].markets.$[market].outcomes.$[outcome].impliedProb': 100 / (outcome.price + 100)
                                    }
                                },
                                {
                                    arrayFilters: [
                                        { 'bookmaker.key': bookmaker.key }, // Match bookmaker by key
                                        { 'market.key': market.key }, // Match market by key
                                        { 'outcome._id': outcome._id } // Match outcome by its _id
                                    ]
                                }
                            );
                        }
                    }));
                }));
            }));
        } catch (error) {
            console.error('Error updating outcomes:', error);
        }
    })
    console.log(`FINISHED CALCULATING IMPLIED PROBABILITY @ ${moment().format('HH:mm:ss')}`) //CLEANED AND FORMATTED
    // Fetch current odds and iterate over them using async loop
    console.info(`Full Seeding complete! 🌱 @ ${moment().format('HH:mm:ss')}`);
}
const espnSeed = async () => {
    const fetchTeamData = async (teamID, sport) => {
        const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport.espnSport}/${sport.league}/teams/${teamID}`);
        const teamData = await response.json();
        return teamData;
    };
    const upsertTeamsInBulk = async (teams, sport) => {
        let TeamModel;
        switch (sport) {
            case 'football':
                TeamModel = UsaFootballTeam;
                break;
            case 'basketball':
                TeamModel = BasketballTeam;
                break;
            case 'hockey':
                TeamModel = HockeyTeam;
                break;
            case 'baseball':
                TeamModel = BaseballTeam;
                break;
            default:
                console.error("Unsupported sport:", sport.espnSport);
                return;
        }
        const bulkOps = teams.map(team => ({
            updateOne: {
                filter: {
                    'espnID': team.espnID,        // Unique to the team
                    'league': team.league,        // Ensures uniqueness within the league
                },
                update: { $set: team },
                upsert: true,
            }
        }));
        await TeamModel.bulkWrite(bulkOps);
    };
    const promises = [];
    const MAX_CONCURRENT_REQUESTS = 2000; // You can adjust this number to control concurrency


    // Loop through each sport
    for (let sport of sports) {
        let teamArr = [];
        console.log(`starting ${sport.league} @ ${moment().format("h:mma")}`)
        // Loop through each team ID sequentially
        if (sport.league === 'college-football' || sport.league === 'mens-college-basketball' || sport.league === 'womens-college-basketball') {
            for (let teamID = 1; teamID < 150000; teamID++) {
                try {
                    promises.push(fetchTeamData(teamID, sport).then((teamListJson) => {
                        // Log the team data if available
                        if (teamListJson && teamListJson.team && teamListJson.team.isActive) {
                            const { id: espnID, location, name: teamName, abbreviation, school, logos, displayName: espnDisplayName } = teamListJson.team;
                            // const espnDisplayName = formatDisplayName(teamListJson.team);
                            teamArr.push({
                                espnID,
                                espnDisplayName,
                                location: location,
                                teamName,
                                league: sport.league,
                                abbreviation,
                                logo: logos ? logos[0].href : undefined,
                                school
                            });
                        }
                        else {
                        }
                    }))

                } catch (error) {
                    console.error(`Error fetching data for team ID#${teamID}:`, error);
                }
                // If we reach the maximum number of concurrent requests, wait for them to resolve
                if (promises.length >= MAX_CONCURRENT_REQUESTS) {
                    await Promise.all(promises);
                    promises.length = 0; // Clear the array after waiting
                }
            }
        } else {
            for (let teamID = 1; teamID < 150000; teamID++) {
                try {
                    promises.push(fetchTeamData(teamID, sport).then((teamListJson) => {

                        // Log the team data if available
                        if (teamListJson && teamListJson.team && teamListJson.team.isActive) {
                            const { id: espnID, location, name: teamName, abbreviation, logos } = teamListJson.team;
                            let espnDisplayName;
                            switch (teamListJson.team.displayName) {
                                case "St. Louis Blues":
                                    espnDisplayName = "St Louis Blues";
                                    break;
                                case "Montreal Canadiens":
                                    espnDisplayName = "Montréal Canadiens";
                                    break;
                                case "LA Clippers":
                                    espnDisplayName = "Los Angeles Clippers";
                                    break;
                                default:
                                    espnDisplayName = teamListJson.team.displayName;
                                    break;
                            }

                            teamArr.push({
                                espnID,
                                espnDisplayName,
                                location,
                                teamName,
                                league: sport.league,
                                abbreviation,
                                logo: logos ? logos[0].href : undefined
                            });
                        } else {
                        }
                    }))
                } catch (error) {
                    console.error(`Error fetching data for team ID#${teamID}:`, error);
                }
                // If we reach the maximum number of concurrent requests, wait for them to resolve
                if (promises.length >= MAX_CONCURRENT_REQUESTS) {
                    await Promise.all(promises);
                    promises.length = 0; // Clear the array after waiting
                }
            }
        }
        console.log(`writing teams @ ${moment().format("h:mma")}`)
        upsertTeamsInBulk(teamArr, sport.espnSport)
        console.log(`finished teams @ ${moment().format("h:mma")}`)
    }


    // Run the normalization function
    // await normalizeAllTeamNames();
    // fetchAllTeamData(sport, teams, sport.statYear)

};


module.exports = { dataSeed, oddsSeed, removeSeed, espnSeed }