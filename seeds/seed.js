require('dotenv').config()
const { Odds, Teams, PastGameOdds } = require('../models');
const axios = require('axios')
const moment = require('moment')
const cheerio = require('cheerio');
const fs = require('fs')
const tf = require('@tensorflow/tfjs-node');

// Suppress TensorFlow.js logging
process.env.TF_CPP_MIN_LOG_LEVEL = '3'; // Suppress logs

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
    },
]
const oddsSeed = async () => {
    // RETRIEVE ODDS
    console.log('BEGINNING ODDS SEEDING')
    await axios.all(sports.map((sport) =>
        axios.get(`https://api.the-odds-api.com/v4/sports/${sport.name}/odds/?apiKey=${process.env.ODDS_KEY_TCDEV}&regions=us&oddsFormat=american&markets=h2h`)
    )).then(async (data) => {
        try {
            data.map(async (item) => {
                item.data.map(async (event) => {
                    if (moment().isBefore(moment(event.commence_time))) {


                        let oddExist = await Odds.findOne({ id: event.id })

                        if (event.sport_key === 'americanfootball_nfl') {
                            if (oddExist) {
                                await Odds.findOneAndUpdate({ id: event.id }, {
                                    sport: 'football',
                                    ...event
                                })

                            } else {
                                await Odds.create({
                                    sport: 'football',
                                    ...event
                                })
                            }
                        } else if (event.sport_key === 'americanfootball_ncaaf') {
                            if (oddExist) {
                                await Odds.findOneAndUpdate({ id: event.id }, {
                                    sport: 'football',
                                    ...event
                                })

                            } else {
                                await Odds.create({
                                    sport: 'football',
                                    ...event
                                })
                            }
                        } else if (event.sport_key === 'basketball_nba') {
                            if (oddExist) {
                                await Odds.findOneAndUpdate({ id: event.id }, {
                                    sport: 'basketball',
                                    ...event
                                })

                            } else {
                                await Odds.create({
                                    sport: 'basketball',
                                    ...event
                                })

                            }
                        } else if (event.sport_key === 'icehockey_nhl') {
                            if (oddExist) {
                                await Odds.findOneAndUpdate({ id: event.id }, {
                                    sport: 'hockey',
                                    ...event
                                })
                            } else {
                                await Odds.create({
                                    sport: 'hockey',
                                    ...event
                                })
                            }
                        } else if (event.sport_key === 'baseball_mlb') {
                            if (oddExist) {
                                await Odds.findOneAndUpdate({ id: event.id }, {
                                    sport: 'baseball',
                                    ...event
                                })

                            } else {
                                await Odds.create({
                                    sport: 'baseball',
                                    ...event
                                })

                            }
                        }
                    }       //WRITE ODDS TO DB
                })
            })
            console.info('Odds Seeding complete! 🌱');
        } catch (err) {
            if (err) throw (err)
        }
    })
}
const dataSeed = async () => {
    // DETERMINE SPORTS
    console.log("DB CONNECTED ---- STARTING SEED")
    // DETERMINE TEAMS
    console.log(`BEGINNING TEAM SEEDING @ ${moment().format('HH:mm:ss')}`)
    // CLEANED AND FORMATTED
    for (i = 0; i < sports.length; i++) {
        let teams = [];
        const formatDisplayName = (team) => {
            const nameMap = {
                "San José State Spartans": "San Jose State Spartans",
                "Massachusetts Minutemen": "UMass Minutemen",
                "Southern Miss Golden Eagles": "Southern Mississippi Golden Eagles",
                "Hawai'i Rainbow Warriors": "Hawaii Rainbow Warriors",
                "Louisiana Ragin' Cajuns": "Louisiana Ragin Cajuns",
                "App State Mountaineers": "Appalachian State Mountaineers",
                "Sam Houston Bearkats": "Sam Houston State Bearkats"
            };
            return nameMap[`${team.school} ${team.mascot}`] || `${team.school} ${team.mascot}`;
        };
        let teamListResponse;
        let teamListJson;
        if (sports[i].name === 'americanfootball_ncaaf') {
            try {
                // Fetch college football teams
                const teamListResponse = await fetch(`https://api.collegefootballdata.com/teams/fbs?year=${sports[i].statYear}`, {
                    headers: {
                        "Authorization": `Bearer ${process.env.CFB_API_KEY}`,
                        "Accept": "application/json"
                    }
                });

                // Parse the response to JSON
                const teamListJson = await teamListResponse.json();

                // Ensure teamListJson is an array before using forEach
                if (Array.isArray(teamListJson)) {
                    teamListJson.forEach((team) => {
                        const { id: espnID, location, mascot: teamName, abbreviation, school, logos } = team;
                        const espnDisplayName = formatDisplayName(team);
                        teams.push({
                            espnID,
                            espnDisplayName,
                            location: location.city,
                            teamName,
                            league: sports[i].league,
                            abbreviation,
                            logo: logos[0],
                            school
                        });
                    });
                } else {
                    console.error("Expected an array but received:", teamListJson);
                }
            } catch (error) {
                console.error("Error fetching or processing team data:", error);
            }
        }
        else {
            try {
                // Fetch non-football teams
                teamListResponse = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sports[i].espnSport}/${sports[i].league}/teams`);
                teamListJson = await teamListResponse.json();
                // if(Array.isArray(teamListJson)){
                const teamList = teamListJson.sports[0].leagues[0].teams;

                teamList.forEach((team) => {
                    const { id: espnID, location, name: teamName, abbreviation, logos } = team.team;
                    const espnDisplayName = team.team.displayName === "St. Louis Blues" ? "St Louis Blues" :
                        team.team.displayName === "Montreal Canadiens" ? "Montréal Canadiens" :
                            team.team.displayName === "LA Clippers" ? "Los Angeles Clippers" :
                                team.team.displayName;

                    teams.push({
                        espnID,
                        espnDisplayName,
                        location,
                        teamName,
                        league: sports[i].league,
                        abbreviation,
                        logo: logos[0].href
                    });
                });
                // }else {
                // console.error("Expected an array but received:", teamListJson);
                // }
            } catch (error) {
                console.error("Error fetching or processing team data:", error);
            }


        }


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
                            if (stat.name === 'differential') {
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

        // Loop through the teams to fetch their records
        for (let x = 0; x < teams.length; x++) {
            // Determine which season type (pre, regular, or post) based on current month
            const teamRecordUrl = getTeamRecordUrl(moment().format('M'), sports[i].startMonth, sports[i].endMonth, sports[i].espnSport, sports[i].league, sports[i].statYear, teams[x].espnID);

            try {
                let teamRecordResponse = await fetch(teamRecordUrl);

                // Check if the response is valid JSON (status is OK and it's JSON format)
                if (!teamRecordResponse.ok) {
                    // If not found, try fetching from the previous year's records
                    if (teamRecordResponse.status === 404) {
                        teamRecordResponse = await fetch(getTeamRecordUrl(moment().format('M'), sports[i].startMonth, sports[i].endMonth, sports[i].espnSport, sports[i].league, sports[i].prevstatYear, teams[x].espnID));
                    } else {
                        throw new Error(`Failed to fetch team record. Status code: ${teamRecordResponse.status}`);
                    }
                }

                // Check if the response is in JSON format
                const contentType = teamRecordResponse.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    const teamRecordJson = await teamRecordResponse.json();
                    updateTeamRecord(teams[x], teamRecordJson);
                } else {
                    // Handle the case where the response is not JSON (e.g., HTML error page)
                    const responseText = await teamRecordResponse.text();
                    console.error(`Expected JSON, but received non-JSON response: ${responseText.slice(0, 500)}`); // Logging a part of the response for debugging
                }
            } catch (error) {
                console.error(`Error fetching or processing record for team ${teams[x].espnID}:`, error);
            }
        }
        // RETRIEVE TEAM SPECIFIC STATS
        // Helper function to update team stats
        const updateTeamStats = (team, statName, value) => {
            const statMap = {
                'turnOverDifferential': 'turnoverDiff',
                'totalPointsPerGame': 'pointsPerGame',
                'yardsPerCompletion': 'passYardsPerPlay',
                'yardsPerRushAttempt': 'rushYardsPerPlay',
                'thirdDownConvPct': 'thirdDownConvRate',
                'redzoneEfficiencyPct': 'redZoneEfficiency',
                'sacks': 'sackRate',
                'completionPct': 'completionPercentage',
                'rushingYardsPerGame': 'rushingYardsPerGame',
                'possessionTimeSeconds': 'avgTimeofPossession',
                'totalPenaltyYards': 'penaltyYardsPerGame',
                'powerPlayPct': 'powerPlayPct',
                'penaltyKillPct': 'penKillPct',
                'avgShots': 'shotsTaken',
                'savePct': 'savePct',
                'avgGoals': 'goalsforPerGame',
                'faceoffsWon': 'faceoffsWon',
                'avgGoalsAgainst': 'goalsAgainstAverage',
                'shootingPct': 'shootingPct',
                'blockedShots': 'shotsBlocked',
                'giveaways': 'giveaways',
                'takeaways': 'takeaways',
                'onBasePct': 'onBasePct',
                'slugAvg': 'sluggingPct',
                'ERA': 'earnedRunAverage',
                'strikeoutToWalkRatio': 'strikeoutWalkRatio',
                'fieldingPct': 'fieldingPercentage',
                'stolenBasePct': 'stolenBasePercentage',
                'errors': 'fieldingErrors',
                'qualityStarts': 'qualityStarts',
                'homeRuns': 'homeRuns',
                'effectiveFGPct': 'effectiveFieldGoalPct',
                'turnoverRatio': 'turnoverDiff',
                'threePointFieldGoalPct': 'threePointPct',
                'avgOffensiveRebounds': 'avgOffensiveRebounds',
                'freeThrowPct': 'freeThrowPct',
                'assistTurnoverRatio': 'assistTurnoverRatio',
                'pointsInPaint': 'pointsInPaint',
                'avgDefensiveRebounds': 'avgDefensiveRebounds',
                'paceFactor': 'pace',
            };

            if (statMap[statName]) {
                team[statMap[statName]] = value;
            }
            return team;
        };

        // Helper function to fetch and update stats for a team
        const fetchAndUpdateStats = async (sport, team, statYear) => {
            const teamStatResponse = await fetch(`https://sports.core.api.espn.com/v2/sports/${sport.espnSport}/leagues/${sport.league}/seasons/${statYear}/types/2/teams/${team.espnID}/statistics?lang=en&region=us`);
            const teamStatjson = await teamStatResponse.json();

            for (const category of teamStatjson.splits.categories) {
                for (const stat of category.stats) {
                    team = updateTeamStats(team, stat.name, stat.value || stat.perGameValue);
                }
            }

            return team;
        };

        // Helper function to update stats from external data sources like TeamRankings
        const updateExternalStats = async (url, statName, statKey) => {
            const request = await axios.get(url, {
                headers: {
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                    "User-Agent": "Mozilla/5.0"
                }
            });
            const $ = await cheerio.load(request.data);
            $('tr').each((i, elem) => {
                const team = $(elem).find('td:nth-child(2)').text().trim();
                const statValue = $(elem).find('td:nth-child(3)').text().trim();
                teams.forEach((teamItem, idx) => {
                    if (teamItem.location === team || teamItem.school === team || teamItem.teamName === team.split(' ')[1]) {
                        teams[idx] = {
                            [statKey]: statValue,
                            ...teams[idx]
                        };
                    }
                });
            });
        };

        // Main loop for different sports
        // for (const sport of sports) {
        if (sports[i].espnSport === 'football') {
            for (const team of teams) {
                await fetchAndUpdateStats(sports[i], team, sports[i].statYear);
            }
            await updateExternalStats(`https://www.teamrankings.com/${sports[i].league}/stat/opponent-yards-per-game`, 'yardsAllowedPerGame', 'yardsAllowedPerGame');
        } else if (sports[i].espnSport === 'hockey') {
            for (const team of teams) {
                await fetchAndUpdateStats(sports[i], team, sports[i].statYear);
            }
        } else if (sports[i].espnSport === 'baseball') {
            for (const team of teams) {
                await fetchAndUpdateStats(sports[i], team, sports[i].statYear);
            }
        } else if (sports[i].espnSport === 'basketball') {
            for (const team of teams) {
                await fetchAndUpdateStats(sports[i], team, sports[i].statYear);
            }
        }
        // WRITE TEAMS TO DB
        const upsertTeam = async (team) => {
            const existingTeam = await Teams.findOne({ 'espnDisplayName': team.espnDisplayName });
            if (existingTeam) {
                await Teams.findOneAndReplace({ 'espnDisplayName': team.espnDisplayName }, team);
            } else {
                await Teams.create(team);
            }
        };
        // Loop through teams and apply the upsert logic
        for (const team of teams) {
            await upsertTeam(team);
        }
        console.log(`Successfuly saved ${sports[i].league} teams @ ${moment().format('HH:mm:ss')}`)
    }
    let currentOdds = await Odds.find() //USE THIS TO POPULATE UPCOMING GAME ODDS
    let nflWeights = []
    let nbaWeights = []
    let mlbWeights = []
    let nhlWeights = []
    let ncaafWeights = []
    async function trainSportModel(sport, gameData) {
        if (gameData.length === 0) {
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
                        getStat(homeStats, 'turnoverDiff') - getStat(awayStats, 'turnoverDiff'),
                        getStat(homeStats, 'pointsPerGame') - getStat(awayStats, 'pointsPerGame'),
                        getStat(homeStats, 'thirdDownConvRate') - getStat(awayStats, 'thirdDownConvRate'),
                        getStat(homeStats, 'redZoneEfficiency') - getStat(awayStats, 'redZoneEfficiency'),
                        getStat(homeStats, 'avgTimeofPossession') - getStat(awayStats, 'avgTimeofPossession'),
                        getStat(homeStats, 'sackRate') - getStat(awayStats, 'sackRate'),
                        getStat(homeStats, 'completionPercentage') - getStat(awayStats, 'completionPercentage'),
                        getStat(homeStats, 'rushingYardsPerGame') - getStat(awayStats, 'rushingYardsPerGame'),
                        getStat(homeStats, 'yardsAllowedPerGame') - getStat(awayStats, 'yardsAllowedPerGame'),
                        getStat(homeStats, 'penaltyYards') - getStat(awayStats, 'penaltyYards'),
                    ];
                case 'americanfootball_ncaaf':
                    return [
                        getWinLoss(homeStats) - getWinLoss(awayStats),
                        getHomeAwayWinLoss(homeStats, 'homeWinLoss') - getHomeAwayWinLoss(awayStats, 'awayWinLoss'),
                        getStat(homeStats, 'pointDiff') - getStat(awayStats, 'pointDiff'),
                        getStat(homeStats, 'turnoverDiff') - getStat(awayStats, 'turnoverDiff'),
                        getStat(homeStats, 'pointsPerGame') - getStat(awayStats, 'pointsPerGame'),
                        getStat(homeStats, 'thirdDownConvRate') - getStat(awayStats, 'thirdDownConvRate'),
                        getStat(homeStats, 'redZoneEfficiency') - getStat(awayStats, 'redZoneEfficiency'),
                        getStat(homeStats, 'avgTimeofPossession') - getStat(awayStats, 'avgTimeofPossession'),
                        getStat(homeStats, 'sackRate') - getStat(awayStats, 'sackRate'),
                        getStat(homeStats, 'completionPercentage') - getStat(awayStats, 'completionPercentage'),
                        getStat(homeStats, 'rushingYardsPerGame') - getStat(awayStats, 'rushingYardsPerGame'),
                        getStat(homeStats, 'yardsAllowedPerGame') - getStat(awayStats, 'yardsAllowedPerGame'),
                        getStat(homeStats, 'penaltyYards') - getStat(awayStats, 'penaltyYards'),
                    ];
                case 'icehockey_nhl':
                    return [
                        getWinLoss(homeStats) - getWinLoss(awayStats),
                        getHomeAwayWinLoss(homeStats, 'homeWinLoss') - getHomeAwayWinLoss(awayStats, 'awayWinLoss'),
                        getStat(homeStats, 'pointDiff') - getStat(awayStats, 'pointDiff'),
                        getStat(homeStats, 'powerPlayPct') - getStat(awayStats, 'powerPlayPct'),
                        getStat(homeStats, 'penKillPct') - getStat(awayStats, 'penKillPct'),
                        getStat(homeStats, 'shotsTaken') - getStat(awayStats, 'shotsTaken'),
                        getStat(homeStats, 'savePct') - getStat(awayStats, 'savePct'),
                        getStat(homeStats, 'goalsforPerGame') - getStat(awayStats, 'goalsforPerGame'),
                        getStat(homeStats, 'faceoffsWon') - getStat(awayStats, 'faceoffsWon'),
                        getStat(homeStats, 'goalsAgainstAverage') - getStat(awayStats, 'goalsAgainstAverage'),
                        getStat(homeStats, 'shootingPct') - getStat(awayStats, 'shootingPct'),
                        getStat(homeStats, 'shotsBlocked') - getStat(awayStats, 'shotsBlocked'),
                        getStat(homeStats, 'giveaways') - getStat(awayStats, 'giveaways'),
                        getStat(homeStats, 'takeaways') - getStat(awayStats, 'takeaways')
                    ];
                case 'baseball_mlb':
                    return [
                        getWinLoss(homeStats) - getWinLoss(awayStats),
                        getHomeAwayWinLoss(homeStats, 'homeWinLoss') - getHomeAwayWinLoss(awayStats, 'awayWinLoss'),
                        getStat(homeStats, 'pointDiff') - getStat(awayStats, 'pointDiff'),
                        getStat(homeStats, 'onBasePct') - getStat(awayStats, 'onBasePct'),
                        getStat(homeStats, 'sluggingPct') - getStat(awayStats, 'sluggingPct'),
                        getStat(homeStats, 'earnedRunAverage') - getStat(awayStats, 'earnedRunAverage'),
                        getStat(homeStats, 'strikeoutWalkRatio') - getStat(awayStats, 'strikeoutWalkRatio'),
                        getStat(homeStats, 'fieldingPercentage') - getStat(awayStats, 'fieldingPercentage'),
                        getStat(homeStats, 'stolenBasePercentage') - getStat(awayStats, 'stolenBasePercentage'),
                        getStat(homeStats, 'fieldingErrors') - getStat(awayStats, 'fieldingErrors'),
                        getStat(homeStats, 'qualityStarts') - getStat(awayStats, 'qualityStarts'),
                        getStat(homeStats, 'homeRuns') - getStat(awayStats, 'homeRuns')
                    ];
                case 'basketball_nba':
                    return [
                        getWinLoss(homeStats) - getWinLoss(awayStats),
                        getHomeAwayWinLoss(homeStats, 'homeWinLoss') - getHomeAwayWinLoss(awayStats, 'awayWinLoss'),
                        getStat(homeStats, 'pointDiff') - getStat(awayStats, 'pointDiff'),
                        getStat(homeStats, 'turnoverDiff') - getStat(awayStats, 'turnoverDiff'),
                        getStat(homeStats, 'effectiveFieldGoalPct') - getStat(awayStats, 'effectiveFieldGoalPct'),
                        getStat(homeStats, 'threePointPct') - getStat(awayStats, 'threePointPct'),
                        getStat(homeStats, 'avgOffensiveRebounds') - getStat(awayStats, 'avgOffensiveRebounds'),
                        getStat(homeStats, 'freeThrowPct') - getStat(awayStats, 'freeThrowPct'),
                        getStat(homeStats, 'assistTurnoverRatio') - getStat(awayStats, 'assistTurnoverRatio'),
                        getStat(homeStats, 'pointsInPaint') - getStat(awayStats, 'pointsInPaint'),
                        getStat(homeStats, 'avgDefensiveRebounds') - getStat(awayStats, 'avgDefensiveRebounds'),
                        getStat(homeStats, 'pace') - getStat(awayStats, 'pace')
                    ];
                default:
                    return [];
            }
        }
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
                    console.log('Loading existing model...');
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
            epochs: 500,
            batchSize: xs.length < 32 ? xs.length : 32,
            validationSplit: 0.9,
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
        // Log loss and accuracy
        const evaluation = model.evaluate(xsTensor, ysTensor);
        let ff = []
        let sportOdds = await Odds.find({ sport_key: sport.name })
        sportOdds.forEach(game => {
            const homeStats = game.homeTeamStats;
            const awayStats = game.awayTeamStats;

            // Extract features based on sport
            const features = extractSportFeatures(homeStats, awayStats, sport.name);

            // Set label to 1 if home team wins, 0 if away team wins
            // const correctPrediction = game.winner = 'home' ? 1 : 0;

            ff.push(features);
            // ys.push(correctPrediction);
        });
        const ffTensor = tf.tensor2d(ff);
        // Get predictions as a promise and wait for it to resolve
        const predictions = await model.predict(ffTensor);
        // Convert tensor to an array of predicted probabilities
        const probabilities = await predictions.array();  // This resolves the tensor to an array
        sportOdds.forEach(async (game, index) => {
            const predictedWinPercent = probabilities[index][0]; // Get the probability for the current game

            // Update the game with the predicted win percentage
            await Odds.findOneAndUpdate({ id: game.id }, { winPercent: predictedWinPercent });
        });
        const loss = evaluation[0].arraySync();
        const accuracy = evaluation[1].arraySync();
        console.log(`${sport.name} Model Loss:`, loss);
        console.log(`${sport.name} Model Accuracy:`, accuracy);
        let weights
        let weightMatrix
        let averages
        const matrixIterator = (matrix) => {
            for (let i = 0; i < matrix.length; i++) {
                let row = matrix[i];
                // Calculate the sum of the 64 weights in the row
                let sum = row.reduce((acc, value) => acc + value, 0);

                // Calculate the average of the row
                let average = Math.abs(sum / row.length);

                // Store the average in the averages array
                averages.push((average * 10));
            }
        }
        function timeDecayAverage(sport, weights) {
            // console.log(sport)
            const decayFactor = sport.decayFactor;
            let weightedSum = 0;
            let sumOfDecayFactors = 0;

            // Apply decay factor to each weight
            for (let i = 0; i < weights.length; i++) {
                const decayWeight = Math.pow(decayFactor, weights.length - i - 1); // Decay decreases as i increases
                weightedSum += weights[i] * decayWeight;
                sumOfDecayFactors += decayWeight;
            }

            // Return the time-decay average
            return weightedSum / sumOfDecayFactors;
        }
        if (sport.name === 'americanfootball_nfl') {
            averages = []
            // Extract weights from the first (input) layer of the model
            weights = model.layers[0].getWeights();
            weightMatrix = await weights[0].array(); // This gives the matrix of weights for each feature

            // Sum weights for each feature (column-wise)
            // Iterate through each row in the weight matrix
            matrixIterator(weightMatrix)

            // Step 2: Normalize the weights (optional, for easier interpretation)
            // let totalWeight = featureWeightsSum.reduce((sum, weight) => sum + weight, 0);
            // normalizedFeatureWeights = featureWeightsSum.map(weight => weight / totalWeight);

            // Step 3: Assign weights to preMade array
            nflWeights = averages
        }
        else if (sport.name === 'americanfootball_ncaaf') {
            averages = []
            // Extract weights from the first (input) layer of the model
            weights = model.layers[0].getWeights();
            weightMatrix = await weights[0].array(); // This gives the matrix of weights for each feature

            // Sum weights for each feature (column-wise)
            // Iterate through each row in the weight matrix
            matrixIterator(weightMatrix)

            // Step 2: Normalize the weights (optional, for easier interpretation)
            // let totalWeight = featureWeightsSum.reduce((sum, weight) => sum + weight, 0);
            // normalizedFeatureWeights = featureWeightsSum.map(weight => weight / totalWeight);

            // Step 3: Assign weights to preMade array
            ncaafWeights = averages
        }
        else if (sport.name === 'basketball_nba') {
            averages = []
            // Extract weights from the first (input) layer of the model
            weights = model.layers[0].getWeights();
            weightMatrix = await weights[0].array(); // This gives the matrix of weights for each feature

            // Sum weights for each feature (column-wise)
            // Iterate through each row in the weight matrix
            matrixIterator(weightMatrix)

            // Step 2: Normalize the weights (optional, for easier interpretation)
            // let totalWeight = featureWeightsSum.reduce((sum, weight) => sum + weight, 0);
            // normalizedFeatureWeights = featureWeightsSum.map(weight => weight / totalWeight);

            // Step 3: Assign weights to preMade array
            nbaWeights = averages
        }
        else if (sport.name === 'bseball_mlb') {
            averages = []
            // Extract weights from the first (input) layer of the model
            weights = model.layers[0].getWeights();
            weightMatrix = await weights[0].array(); // This gives the matrix of weights for each feature

            // Sum weights for each feature (column-wise)
            // Iterate through each row in the weight matrix
            matrixIterator(weightMatrix)

            // Step 2: Normalize the weights (optional, for easier interpretation)
            // let totalWeight = featureWeightsSum.reduce((sum, weight) => sum + weight, 0);
            // normalizedFeatureWeights = featureWeightsSum.map(weight => weight / totalWeight);

            // Step 3: Assign weights to preMade array
            mlbWeights = averages
        }
        else if (sport.name === 'icehockey_nhl') {
            averages = []
            // Extract weights from the first (input) layer of the model
            weights = model.layers[0].getWeights();
            weightMatrix = await weights[0].array(); // This gives the matrix of weights for each feature

            // Sum weights for each feature (column-wise)
            // Iterate through each row in the weight matrix
            matrixIterator(weightMatrix)

            // Step 2: Normalize the weights (optional, for easier interpretation)
            // let totalWeight = featureWeightsSum.reduce((sum, weight) => sum + weight, 0);
            // normalizedFeatureWeights = featureWeightsSum.map(weight => weight / totalWeight);

            // Step 3: Assign weights to preMade array
            nhlWeights = averages
        }
        //DETERMINE H2H INDEXES FOR EVERY GAME IN ODDS
        console.log(`DETERMINING ${sport.name} INDEXES @ ${moment().format('HH:mm:ss')}`); //CLEANED AND FORMATTED
        // Helper function to adjust indexes for football games
        function adjustnflStats(homeTeam, awayTeam, homeIndex, awayIndex) {
            homeTeam.seasonWinLoss.split("-")[0] >= awayTeam.seasonWinLoss.split("-")[0] ? homeIndex += nflWeights[0] : awayIndex += nflWeights[0];
            homeTeam.homeWinLoss.split("-")[0] >= awayTeam.awayWinLoss.split("-")[0] ? homeIndex += nflWeights[1] : awayIndex += nflWeights[1];
            homeTeam.pointDiff >= awayTeam.pointDiff ? homeIndex += nflWeights[2] : awayIndex += nflWeights[2];
            homeTeam.turnoverDiff >= awayTeam.turnoverDiff ? homeIndex += nflWeights[3] : awayIndex += nflWeights[3];
            homeTeam.pointsPerGame >= awayTeam.pointsPerGame ? homeIndex += nflWeights[4] : awayIndex += nflWeights[4];
            homeTeam.thirdDownConvRate >= awayTeam.thirdDownConvRate ? homeIndex += nflWeights[5] : awayIndex += nflWeights[5];
            homeTeam.redZoneEfficiency >= awayTeam.redZoneEfficiency ? homeIndex += nflWeights[6] : awayIndex += nflWeights[6];
            homeTeam.avgTimeofPossession >= awayTeam.avgTimeofPossession ? homeIndex += nflWeights[7] : awayIndex += nflWeights[7];
            homeTeam.sackRate >= awayTeam.sackRate ? homeIndex += nflWeights[8] : awayIndex += nflWeights[8];
            homeTeam.completionPercentage >= awayTeam.completionPercentage ? homeIndex += nflWeights[9] : awayIndex += nflWeights[9];
            homeTeam.rushingYardsPerGame >= awayTeam.rushingYardsPerGame ? homeIndex += nflWeights[10] : awayIndex += nflWeights[10];
            homeTeam.yardsAllowedPerGame <= awayTeam.yardsAllowedPerGame ? homeIndex += nflWeights[11] : awayIndex += nflWeights[11];
            homeTeam.penaltyYardsPerGame <= awayTeam.penaltyYardsPerGame ? homeIndex += nflWeights[12] : awayIndex += nflWeights[12];
            return { homeIndex, awayIndex };
        }
        function adjustncaafStats(homeTeam, awayTeam, homeIndex, awayIndex) {
            homeTeam.seasonWinLoss.split("-")[0] >= awayTeam.seasonWinLoss.split("-")[0] ? homeIndex += ncaafWeights[0] : awayIndex += ncaafWeights[0];
            homeTeam.homeWinLoss.split("-")[0] >= awayTeam.awayWinLoss.split("-")[0] ? homeIndex += ncaafWeights[1] : awayIndex += ncaafWeights[1];
            homeTeam.pointDiff >= awayTeam.pointDiff ? homeIndex += ncaafWeights[2] : awayIndex += ncaafWeights[2];
            homeTeam.turnoverDiff >= awayTeam.turnoverDiff ? homeIndex += ncaafWeights[3] : awayIndex += ncaafWeights[3];
            homeTeam.pointsPerGame >= awayTeam.pointsPerGame ? homeIndex += ncaafWeights[4] : awayIndex += ncaafWeights[4];
            homeTeam.thirdDownConvRate >= awayTeam.thirdDownConvRate ? homeIndex += ncaafWeights[5] : awayIndex += ncaafWeights[5];
            homeTeam.redZoneEfficiency >= awayTeam.redZoneEfficiency ? homeIndex += ncaafWeights[6] : awayIndex += ncaafWeights[6];
            homeTeam.avgTimeofPossession >= awayTeam.avgTimeofPossession ? homeIndex += ncaafWeights[7] : awayIndex += ncaafWeights[7];
            homeTeam.sackRate >= awayTeam.sackRate ? homeIndex += ncaafWeights[8] : awayIndex += ncaafWeights[8];
            homeTeam.completionPercentage >= awayTeam.completionPercentage ? homeIndex += ncaafWeights[9] : awayIndex += ncaafWeights[9];
            homeTeam.rushingYardsPerGame >= awayTeam.rushingYardsPerGame ? homeIndex += ncaafWeights[10] : awayIndex += ncaafWeights[10];
            homeTeam.yardsAllowedPerGame <= awayTeam.yardsAllowedPerGame ? homeIndex += ncaafWeights[11] : awayIndex += ncaafWeights[11];
            homeTeam.penaltyYardsPerGame <= awayTeam.penaltyYardsPerGame ? homeIndex += ncaafWeights[12] : awayIndex += ncaafWeights[12];
            return { homeIndex, awayIndex };
        }
        // Helper function to adjust indexes for hockey games
        function adjustnhlStats(homeTeam, awayTeam, homeIndex, awayIndex) {
            homeTeam.seasonWinLoss.split("-")[0] >= awayTeam.seasonWinLoss.split("-")[0] ? homeIndex += nhlWeights[0] : awayIndex += nhlWeights[0];
            homeTeam.homeWinLoss.split("-")[0] >= awayTeam.awayWinLoss.split("-")[0] ? homeIndex += nhlWeights[1] : awayIndex += nhlWeights[1];
            homeTeam.pointDiff >= awayTeam.pointDiff ? homeIndex += nhlWeights[2] : awayIndex += nhlWeights[2];
            homeTeam.powerPlayPct >= awayTeam.powerPlayPct ? homeIndex += nhlWeights[3] : awayIndex += nhlWeights[3];
            homeTeam.penKillPct >= awayTeam.penKillPct ? homeIndex += nhlWeights[4] : awayIndex += nhlWeights[4];
            homeTeam.shotsTaken >= awayTeam.shotsTaken ? homeIndex += nhlWeights[5] : awayIndex += nhlWeights[5];
            homeTeam.savePct >= awayTeam.savePct ? homeIndex += nhlWeights[6] : awayIndex += nhlWeights[6];
            homeTeam.goalsforPerGame >= awayTeam.goalsforPerGame ? homeIndex += nhlWeights[7] : awayIndex += nhlWeights[7];
            homeTeam.faceoffsWon <= awayTeam.faceoffsWon ? homeIndex += nhlWeights[8] : awayIndex += nhlWeights[8];
            homeTeam.goalsAgainstAverage <= awayTeam.goalsAgainstAverage ? homeIndex += nhlWeights[9] : awayIndex += nhlWeights[9];
            homeTeam.shootingPct >= awayTeam.shootingPct ? homeIndex += nhlWeights[10] : awayIndex += nhlWeights[10];
            homeTeam.shotsBlocked >= awayTeam.shotsBlocked ? homeIndex += nhlWeights[11] : awayIndex += nhlWeights[11];
            homeTeam.giveaways <= awayTeam.giveaways ? homeIndex += nhlWeights[12] : awayIndex += nhlWeights[12];
            homeTeam.takeaways >= awayTeam.takeaways ? homeIndex += nhlWeights[13] : awayIndex += nhlWeights[13];
            return { homeIndex, awayIndex };
        }
        // Helper function to adjust indexes for basketball games
        function adjustnbaStats(homeTeam, awayTeam, homeIndex, awayIndex) {
            homeTeam.seasonWinLoss.split("-")[0] >= awayTeam.seasonWinLoss.split("-")[0] ? homeIndex += nbaWeights[0] : awayIndex += nbaWeights[0];
            homeTeam.homeWinLoss.split("-")[0] >= awayTeam.awayWinLoss.split("-")[0] ? homeIndex += nbaWeights[1] : awayIndex += nbaWeights[1];
            homeTeam.pointDiff >= awayTeam.pointDiff ? homeIndex += nbaWeights[2] : awayIndex += nbaWeights[2];
            homeTeam.effectiveFieldGoalPct >= awayTeam.effectiveFieldGoalPct ? homeIndex += nbaWeights[3] : awayIndex += nbaWeights[3];
            homeTeam.turnoverDiff >= awayTeam.turnoverDiff ? homeIndex += nbaWeights[4] : awayIndex += nbaWeights[4];
            homeTeam.threePointPct >= awayTeam.threePointPct ? homeIndex += nbaWeights[5] : awayIndex += nbaWeights[5];
            homeTeam.avgOffensiveRebounds >= awayTeam.avgOffensiveRebounds ? homeIndex += nbaWeights[6] : awayIndex += nbaWeights[6];
            homeTeam.freeThrowPct >= awayTeam.freeThrowPct ? homeIndex += nbaWeights[7] : awayIndex += nbaWeights[7];
            homeTeam.assistTurnoverRatio >= awayTeam.assistTurnoverRatio ? homeIndex += nbaWeights[8] : awayIndex += nbaWeights[8];
            homeTeam.pointsInPaint >= awayTeam.pointsInPaint ? homeIndex += nbaWeights[9] : awayIndex += nbaWeights[9];
            homeTeam.avgDefensiveRebounds >= awayTeam.avgDefensiveRebounds ? homeIndex += nbaWeights[10] : awayIndex += nbaWeights[10];
            homeTeam.pace >= awayTeam.pace ? homeIndex += nbaWeights[11] : awayIndex += nbaWeights[11];
            return { homeIndex, awayIndex };
        }
        // Helper function to adjust indexes for baseball games
        function adjustmlbStats(homeTeam, awayTeam, homeIndex, awayIndex) {
            homeTeam.seasonWinLoss.split("-")[0] >= awayTeam.seasonWinLoss.split("-")[0] ? homeIndex += mlbWeights[0] : awayIndex += mlbWeights[0];
            homeTeam.homeWinLoss.split("-")[0] >= awayTeam.awayWinLoss.split("-")[0] ? homeIndex += mlbWeights[1] : awayIndex += mlbWeights[1];
            homeTeam.pointDiff >= awayTeam.pointDiff ? homeIndex += mlbWeights[2] : awayIndex += mlbWeights[2];
            homeTeam.onBasePct >= awayTeam.onBasePct ? homeIndex += mlbWeights[3] : awayIndex += mlbWeights[3];
            homeTeam.sluggingPct >= awayTeam.sluggingPct ? homeIndex += mlbWeights[4] : awayIndex += mlbWeights[4];
            homeTeam.earnedRunAverage <= awayTeam.earnedRunAverage ? homeIndex += mlbWeights[5] : awayIndex += mlbWeights[5];
            homeTeam.strikeoutWalkRatio <= awayTeam.strikeoutWalkRatio ? homeIndex += mlbWeights[6] : awayIndex += mlbWeights[6];
            homeTeam.fieldingPercentage >= awayTeam.fieldingPercentage ? homeIndex += mlbWeights[7] : awayIndex += mlbWeights[7];
            homeTeam.stolenBasePercentage >= awayTeam.stolenBasePercentage ? homeIndex += mlbWeights[8] : awayIndex += mlbWeights[8];
            homeTeam.fieldingErrors <= awayTeam.fieldingErrors ? homeIndex += mlbWeights[9] : awayIndex += mlbWeights[9];
            homeTeam.qualityStarts >= awayTeam.qualityStarts ? homeIndex += mlbWeights[10] : awayIndex += mlbWeights[10];
            homeTeam.homeRuns >= awayTeam.homeRuns ? homeIndex += mlbWeights[11] : awayIndex += mlbWeights[11];
            return { homeIndex, awayIndex };
        }
        currentOdds.map(async (game, index) => {
            // Check if the game is in the future
            if (moment().isBefore(moment(game.commence_time))) {
                let homeTeam = await Teams.findOne({ 'espnDisplayName': game.home_team });
                let awayTeam = await Teams.findOne({ 'espnDisplayName': game.away_team });
                let homeIndex = 0;
                let awayIndex = 0;
                if (homeTeam && awayTeam) {
                    // Sport-specific conditions
                    if (game.sport_key === 'americanfootball_nfl') {
                        // Apply various football statistics for the index calculation
                        ({ homeIndex, awayIndex } = adjustnflStats(homeTeam, awayTeam, homeIndex, awayIndex));
                    }
                    else if (game.sport_key === 'americanfootball_ncaaf') {
                        // Apply college football statistics
                        ({ homeIndex, awayIndex } = adjustncaafStats(homeTeam, awayTeam, homeIndex, awayIndex));
                    }
                    else if (game.sport_key === 'icehockey_nhl') {
                        // Apply hockey-specific statistics
                        ({ homeIndex, awayIndex } = adjustnhlStats(homeTeam, awayTeam, homeIndex, awayIndex));
                    }
                    else if (game.sport_key === 'basketball_nba') {
                        // Apply basketball-specific statistics
                        ({ homeIndex, awayIndex } = adjustnbaStats(homeTeam, awayTeam, homeIndex, awayIndex));
                    }
                    else if (game.sport_key === 'baseball_mlb') {
                        // Apply baseball-specific statistics
                        ({ homeIndex, awayIndex } = adjustmlbStats(homeTeam, awayTeam, homeIndex, awayIndex));
                    }
                }
                const getCommonStats = (team) => ({
                    seasonWinLoss: team.seasonWinLoss,
                    homeWinLoss: team.homeWinLoss,
                    awayWinLoss: team.awayWinLoss,
                    pointDiff: team.pointDiff,
                    takeawaysPerGame: team.takeawaysPerGame, // USAFootball stat
                    giveawaysPerGame: team.giveawaysPerGame, // USAFootball stat
                    turnoverDiff: team.turnoverDiff, // USAFootball stat
                    pointsPerGame: team.pointsPerGame, // USAFootball stat
                    yardsPerPlay: team.yardsPerPlay, // USAFootball stat
                    thirdDownConvRate: team.thirdDownConvRate, // USAFootball stat
                    redZoneEfficiency: team.redZoneEfficiency, // USAFootball stat
                    avgTimeofPossession: team.avgTimeofPossession, // USAFootball stat
                    sackRate: team.sackRate, // USAFootball stat
                    completionPercentage: team.completionPercentage, // USAFootball stat
                    rushingYardsPerGame: team.rushingYardsPerGame, // USAFootball stat
                    yardsAllowedPerGame: team.yardsAllowedPerGame, // USAFootball stat
                    penaltyYardsPerGame: team.penaltyYardsPerGame, // USAFootball stat
                    powerPlayPct: team.powerPlayPct, // Hockey stat
                    penKillPct: team.penKillPct, // Hockey stat
                    shotsTaken: team.shotsTaken, // Hockey stat
                    savePct: team.savePct, // Hockey stat
                    goalsforPerGame: team.goalsforPerGame, // Hockey stat
                    faceoffsWon: team.faceoffsWon, // Hockey stat
                    goalsAgainstAverage: team.goalsAgainstAverage, // Hockey stat
                    shootingPct: team.shootingPct, // Hockey stat
                    shotsBlocked: team.shotsBlocked, // Hockey stat
                    giveaways: team.giveaways, // Hockey stat
                    takeaways: team.takeaways, // Hockey stat
                    onBasePct: team.onBasePct, // Baseball stat
                    sluggingPct: team.sluggingPct, // Baseball stat
                    earnedRunAverage: team.earnedRunAverage, // Baseball stat
                    strikeoutWalkRatio: team.strikeoutWalkRatio, // Baseball stat
                    fieldingPercentage: team.fieldingPercentage, // Baseball stat
                    stolenBasePercentage: team.stolenBasePercentage, // Baseball stat
                    fieldingErrors: team.fieldingErrors, // Baseball stat
                    qualityStarts: team.qualityStarts, // Baseball stat
                    homeRuns: team.homeRuns, // Baseball stat
                    effectiveFieldGoalPct: team.effectiveFieldGoalPct, // Basketball stat
                    turnoverDiff: team.turnoverDiff, // Basketball stat
                    threePointPct: team.threePointPct, // Basketball stat
                    avgOffensiveRebounds: team.avgOffensiveRebounds, // Basketball stat
                    freeThrowPct: team.freeThrowPct, // Basketball stat
                    assistTurnoverRatio: team.assistTurnoverRatio, // Basketball stat
                    pointsInPaint: team.pointsInPaint, // Basketball stat
                    avgDefensiveRebounds: team.avgDefensiveRebounds, // Basketball stat
                    pace: team.pace // Basketball stat
                });
                // Update the Odds database with the calculated indices
                if (sport.espnSport === game.sport) {
                    await Odds.findOneAndUpdate({ 'id': game.id }, {
                        homeTeamIndex: homeIndex * 10 || 0,
                        awayTeamIndex: awayIndex * 10 || 0,
                        homeTeamStats: getCommonStats(homeTeam),
                        awayTeamStats: getCommonStats(awayTeam),
                    });
                }
            }
        });
    }
    for (sport = 0; sport < sports.length; sport++) {
        const pastGames = await PastGameOdds.find({ sport_key: sports[sport].name })
        await trainSportModel(sports[sport], pastGames)
    }
    console.log('CALCULATING Implied Probability') //CLEANED AND FORMATTED
    // let allPastGames = await PastGameOdds.find({})
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
    console.log(`REMOVING PAST GAMES @ ${moment().format('HH:mm:ss')}`) //CLEANED AND FORMATTED
    // Fetch current odds and iterate over them using async loop
    pastGames = [];
    currentOdds = await Odds.find();
    for (let game of currentOdds) {
        // Check if the game is in the past based on commence_time
        if (moment(game.commence_time).local().isBefore(moment().local())) {
            let { _id, ...newGame } = game._doc;
            let homeTeam, awayTeam;
            let homeScore, awayScore, predictionCorrect, winner;

            // Fetch team details from the Teams collection
            homeTeam = await Teams.findOne({ 'espnDisplayName': game.home_team });
            awayTeam = await Teams.findOne({ 'espnDisplayName': game.away_team });

            try {
                // Fetch home team schedule from ESPN API
                let homeTeamSchedule = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${game.sport}/${homeTeam.league}/teams/${homeTeam.espnID}/schedule`);
                let homeTeamSchedJSON = await homeTeamSchedule.json();

                // Loop through events in the home team schedule
                for (let event of homeTeamSchedJSON.events) {
                    // Check if the event matches the current game's date
                    if (moment(event.date).local().format('MM/DD/YYYY') === moment(game.commence_time).local().format('MM/DD/YYYY')) {
                        if (event.competitions[0].status.type.completed === true) {

                            // Delete the game from the Odds collection
                            let deletedGame = await Odds.findOneAndDelete({ _id: game._doc._id });
                            if (deletedGame) {
                                console.log(`deleted game: ${deletedGame.home_team} vs ${deletedGame.away_team}`);
                            }

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
                                takeawaysPerGame: team.takeawaysPerGame, // USAFootball stat
                                giveawaysPerGame: team.giveawaysPerGame, // USAFootball stat
                                turnoverDiff: team.turnoverDiff, // USAFootball stat
                                pointsPerGame: team.pointsPerGame, // USAFootball stat
                                yardsPerPlay: team.yardsPerPlay, // USAFootball stat
                                thirdDownConvRate: team.thirdDownConvRate, // USAFootball stat
                                redZoneEfficiency: team.redZoneEfficiency, // USAFootball stat
                                avgTimeofPossession: team.avgTimeofPossession, // USAFootball stat
                                sackRate: team.sackRate, // USAFootball stat
                                completionPercentage: team.completionPercentage, // USAFootball stat
                                rushingYardsPerGame: team.rushingYardsPerGame, // USAFootball stat
                                yardsAllowedPerGame: team.yardsAllowedPerGame, // USAFootball stat
                                penaltyYardsPerGame: team.penaltyYardsPerGame, // USAFootball stat
                                powerPlayPct: team.powerPlayPct, // Hockey stat
                                penKillPct: team.penKillPct, // Hockey stat
                                shotsTaken: team.shotsTaken, // Hockey stat
                                savePct: team.savePct, // Hockey stat
                                goalsforPerGame: team.goalsforPerGame, // Hockey stat
                                faceoffsWon: team.faceoffsWon, // Hockey stat
                                goalsAgainstAverage: team.goalsAgainstAverage, // Hockey stat
                                shootingPct: team.shootingPct, // Hockey stat
                                shotsBlocked: team.shotsBlocked, // Hockey stat
                                giveaways: team.giveaways, // Hockey stat
                                takeaways: team.takeaways, // Hockey stat
                                onBasePct: team.onBasePct, // Baseball stat
                                sluggingPct: team.sluggingPct, // Baseball stat
                                earnedRunAverage: team.earnedRunAverage, // Baseball stat
                                strikeoutWalkRatio: team.strikeoutWalkRatio, // Baseball stat
                                fieldingPercentage: team.fieldingPercentage, // Baseball stat
                                stolenBasePercentage: team.stolenBasePercentage, // Baseball stat
                                fieldingErrors: team.fieldingErrors, // Baseball stat
                                qualityStarts: team.qualityStarts, // Baseball stat
                                homeRuns: team.homeRuns, // Baseball stat
                                effectiveFieldGoalPct: team.effectiveFieldGoalPct, // Basketball stat
                                turnoverDiff: team.turnoverDiff, // Basketball stat
                                threePointPct: team.threePointPct, // Basketball stat
                                avgOffensiveRebounds: team.avgOffensiveRebounds, // Basketball stat
                                freeThrowPct: team.freeThrowPct, // Basketball stat
                                assistTurnoverRatio: team.assistTurnoverRatio, // Basketball stat
                                pointsInPaint: team.pointsInPaint, // Basketball stat
                                avgDefensiveRebounds: team.avgDefensiveRebounds, // Basketball stat
                                pace: team.pace // Basketball stat
                            });
                            // Save the past game to the PastGameOdds collection
                            await PastGameOdds.create({
                                homeScore,
                                awayScore,
                                winner,
                                predictionCorrect,
                                homeTeamStats: getCommonStats(homeTeam),
                                awayTeamStats: getCommonStats(awayTeam),
                                ...newGame
                            });

                        }
                    }
                }
            } catch (err) {
                console.log(err); // Log any errors encountered during the API call or processing
            }
        }
    }
    console.log("Past games processed successfully!");
    console.info(`Full Seeding complete! 🌱 @ ${moment().format('HH:mm:ss')}`);
}
module.exports = { dataSeed, oddsSeed }