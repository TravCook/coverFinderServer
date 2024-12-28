require('dotenv').config()
const { Odds, Teams, PastGameOdds } = require('../models');
const axios = require('axios')
const moment = require('moment')
const cheerio = require('cheerio');
const tf = require('@tensorflow/tfjs');

const oddsSeed = async () => {
    let sports = [
        {
            name: "americanfootball_nfl",
            espnSport: 'football',
            league: 'nfl',
            startMonth: 9,
            endMonth: 2,
            multiYear: true,
            statYear: 2024
        },
        {
            name: "americanfootball_ncaaf",
            espnSport: 'football',
            league: 'college-football',
            startMonth: 9,
            endMonth: 1,
            multiYear: true,
            statYear: 2024
        },
        {
            name: "basketball_nba",
            espnSport: 'basketball',
            league: 'nba',
            startMonth: 10,
            endMonth: 4,
            multiYear: true,
            statYear: 2024
        },
        {
            name: "icehockey_nhl",
            espnSport: 'hockey',
            league: 'nhl',
            startMonth: 10,
            endMonth: 4,
            multiYear: true,
            statYear: 2025,
            prevstatYear: 2024
        },
        {
            name: "baseball_mlb",
            espnSport: 'baseball',
            league: 'mlb',
            startMonth: 3,
            endMonth: 10,
            multiYear: false,
            statYear: 2024
        },
    ]
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
    let sports = [
        {
            name: "americanfootball_nfl",
            espnSport: 'football',
            league: 'nfl',
            startMonth: 9,
            endMonth: 2,
            multiYear: true,
            statYear: 2024
        },
        {
            name: "americanfootball_ncaaf",
            espnSport: 'football',
            league: 'college-football',
            startMonth: 9,
            endMonth: 1,
            multiYear: true,
            statYear: 2024
        },
        {
            name: "basketball_nba",
            espnSport: 'basketball',
            league: 'nba',
            startMonth: 10,
            endMonth: 4,
            multiYear: true,
            statYear: 2025
        },
        {
            name: "icehockey_nhl",
            espnSport: 'hockey',
            league: 'nhl',
            startMonth: 10,
            endMonth: 4,
            multiYear: true,
            statYear: 2025,
            prevstatYear: 2024
        },
        {
            name: "baseball_mlb",
            espnSport: 'baseball',
            league: 'mlb',
            startMonth: 3,
            endMonth: 10,
            multiYear: false,
            statYear: 2024
        },
    ]
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
            // Fetch non-football teams
            teamListResponse = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sports[i].espnSport}/${sports[i].league}/teams`);
            teamListJson = await teamListResponse.json();
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
    let footballWeights = []
    let basketballWeights = []
    let baseballWeights = []
    let hockeyWeights = []
    async function trainSportModel(sport, gameData) {
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
        function extractSportFeatures(homeStats, awayStats, sport) {
            switch (sport) {
                case 'football':
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
                case 'hockey':
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
                case 'baseball':
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
                case 'basketball':
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
            const features = extractSportFeatures(homeStats, awayStats, sport);

            // Set label to 1 if home team wins, 0 if away team wins
            const correctPrediction = game.winner = 'home' ? 1 : 0;

            xs.push(features);
            ys.push(correctPrediction);
        });
        // Convert arrays to tensors
        const xsTensor = tf.tensor2d(xs);
        const ysTensor = tf.tensor2d(ys, [ys.length, 1]);

        // Define the model
        let model = tf.sequential();
        model.add(tf.layers.dense({ units: 64, inputShape: [xs[0].length], activation: 'relu', kernelInitializer: 'glorotUniform', biasInitializer: 'zeros' }));
        model.add(tf.layers.dense({ units: xs[0].length * 2, activation: 'relu', kernelInitializer: 'glorotUniform', biasInitializer: 'zeros' }));
        model.add(tf.layers.dense({ units: xs[0].length * 2, activation: 'relu', kernelInitializer: 'glorotUniform', biasInitializer: 'zeros' }));
        model.add(tf.layers.dense({ units: 1, activation: 'sigmoid', kernelInitializer: 'glorotUniform', biasInitializer: 'zeros' }));

        // Compile the model
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
            batchSize: 32,
            validationSplit: 0.2,
            shuffle: false,
        });

        // Save model specific to the sport
        // await model.save(`file://./model_checkpoint/${sport}_model.json`);

        // Log loss and accuracy
        const evaluation = model.evaluate(xsTensor, ysTensor);
        const loss = evaluation[0].arraySync();
        const accuracy = evaluation[1].arraySync();

        console.log(`${sport} Model Loss:`, loss);
        console.log(`${sport} Model Accuracy:`, accuracy);
        if (accuracy > .95) {
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
                    averages.push(average * 10);
                }
            }
            if (sport === 'football') {
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
                footballWeights = averages
            }
            else if (sport === 'basketball') {
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
                basketballWeights = averages
            }
            else if (sport === 'baseball') {
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
                baseballWeights = averages
            }
            else if (sport === 'hockey') {
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
                hockeyWeights = averages
            }
            //DETERMINE H2H INDEXES FOR EVERY GAME IN ODDS
            console.log(`DETERMINING ${sport} INDEXES @ ${moment().format('HH:mm:ss')}`); //CLEANED AND FORMATTED
            // Helper function to adjust indexes for football games
            function adjustFootballStats(homeTeam, awayTeam, homeIndex, awayIndex) {
                homeTeam.seasonWinLoss.split("-")[0] >= awayTeam.seasonWinLoss.split("-")[0] ? homeIndex += footballWeights[0] : awayIndex += footballWeights[0];
                homeTeam.homeWinLoss.split("-")[0] >= awayTeam.awayWinLoss.split("-")[0] ? homeIndex += footballWeights[1] : awayIndex += footballWeights[1];
                homeTeam.pointDiff >= awayTeam.pointDiff ? homeIndex += footballWeights[2] : awayIndex += footballWeights[2];
                homeTeam.turnoverDiff >= awayTeam.turnoverDiff ? homeIndex += footballWeights[3] : awayIndex += footballWeights[3];
                homeTeam.pointsPerGame >= awayTeam.pointsPerGame ? homeIndex += footballWeights[4] : awayIndex += footballWeights[4];
                homeTeam.thirdDownConvRate >= awayTeam.thirdDownConvRate ? homeIndex += footballWeights[5] : awayIndex += footballWeights[5];
                homeTeam.redZoneEfficiency >= awayTeam.redZoneEfficiency ? homeIndex += footballWeights[6] : awayIndex += footballWeights[6];
                homeTeam.avgTimeofPossession >= awayTeam.avgTimeofPossession ? homeIndex += footballWeights[7] : awayIndex += footballWeights[7];
                homeTeam.sackRate >= awayTeam.sackRate ? homeIndex += footballWeights[8] : awayIndex += footballWeights[8];
                homeTeam.completionPercentage >= awayTeam.completionPercentage ? homeIndex += footballWeights[9] : awayIndex += footballWeights[9];
                homeTeam.rushingYardsPerGame >= awayTeam.rushingYardsPerGame ? homeIndex += footballWeights[10] : awayIndex += footballWeights[10];
                homeTeam.yardsAllowedPerGame <= awayTeam.yardsAllowedPerGame ? homeIndex += footballWeights[11] : awayIndex += footballWeights[11];
                homeTeam.penaltyYardsPerGame <= awayTeam.penaltyYardsPerGame ? homeIndex += footballWeights[12] : awayIndex += footballWeights[12];
                return { homeIndex, awayIndex };
            }
            // Helper function to adjust indexes for hockey games
            function adjustHockeyStats(homeTeam, awayTeam, homeIndex, awayIndex) {
                homeTeam.seasonWinLoss.split("-")[0] >= awayTeam.seasonWinLoss.split("-")[0] ? homeIndex += hockeyWeights[0] : awayIndex += hockeyWeights[0];
                homeTeam.homeWinLoss.split("-")[0] >= awayTeam.awayWinLoss.split("-")[0] ? homeIndex += hockeyWeights[1] : awayIndex += hockeyWeights[1];
                homeTeam.pointDiff >= awayTeam.pointDiff ? homeIndex += hockeyWeights[2] : awayIndex += hockeyWeights[2];
                homeTeam.powerPlayPct >= awayTeam.powerPlayPct ? homeIndex += hockeyWeights[3] : awayIndex += hockeyWeights[3];
                homeTeam.penKillPct >= awayTeam.penKillPct ? homeIndex += hockeyWeights[4] : awayIndex += hockeyWeights[4];
                homeTeam.shotsTaken >= awayTeam.shotsTaken ? homeIndex += hockeyWeights[5] : awayIndex += hockeyWeights[5];
                homeTeam.savePct >= awayTeam.savePct ? homeIndex += hockeyWeights[6] : awayIndex += hockeyWeights[6];
                homeTeam.goalsforPerGame >= awayTeam.goalsforPerGame ? homeIndex += hockeyWeights[7] : awayIndex += hockeyWeights[7];
                homeTeam.faceoffsWon <= awayTeam.faceoffsWon ? homeIndex += hockeyWeights[8] : awayIndex += hockeyWeights[8];
                homeTeam.goalsAgainstAverage <= awayTeam.goalsAgainstAverage ? homeIndex += hockeyWeights[9] : awayIndex += hockeyWeights[9];
                homeTeam.shootingPct >= awayTeam.shootingPct ? homeIndex += hockeyWeights[10] : awayIndex += hockeyWeights[10];
                homeTeam.shotsBlocked >= awayTeam.shotsBlocked ? homeIndex += hockeyWeights[11] : awayIndex += hockeyWeights[11];
                homeTeam.giveaways <= awayTeam.giveaways ? homeIndex += hockeyWeights[12] : awayIndex += hockeyWeights[12];
                homeTeam.takeaways >= awayTeam.takeaways ? homeIndex += hockeyWeights[13] : awayIndex += hockeyWeights[13];
                return { homeIndex, awayIndex };
            }
            // Helper function to adjust indexes for basketball games
            function adjustBasketballStats(homeTeam, awayTeam, homeIndex, awayIndex) {
                homeTeam.seasonWinLoss.split("-")[0] >= awayTeam.seasonWinLoss.split("-")[0] ? homeIndex += basketballWeights[0] : awayIndex += basketballWeights[0];
                homeTeam.homeWinLoss.split("-")[0] >= awayTeam.awayWinLoss.split("-")[0] ? homeIndex += basketballWeights[1] : awayIndex += basketballWeights[1];
                homeTeam.pointDiff >= awayTeam.pointDiff ? homeIndex += basketballWeights[2] : awayIndex += basketballWeights[2];
                homeTeam.effectiveFieldGoalPct >= awayTeam.effectiveFieldGoalPct ? homeIndex += basketballWeights[3] : awayIndex += basketballWeights[3];
                homeTeam.turnoverDiff >= awayTeam.turnoverDiff ? homeIndex += basketballWeights[4] : awayIndex += basketballWeights[4];
                homeTeam.threePointPct >= awayTeam.threePointPct ? homeIndex += basketballWeights[5] : awayIndex += basketballWeights[5];
                homeTeam.avgOffensiveRebounds >= awayTeam.avgOffensiveRebounds ? homeIndex += basketballWeights[6] : awayIndex += basketballWeights[6];
                homeTeam.freeThrowPct >= awayTeam.freeThrowPct ? homeIndex += basketballWeights[7] : awayIndex += basketballWeights[7];
                homeTeam.assistTurnoverRatio >= awayTeam.assistTurnoverRatio ? homeIndex += basketballWeights[8] : awayIndex += basketballWeights[8];
                homeTeam.pointsInPaint >= awayTeam.pointsInPaint ? homeIndex += basketballWeights[9] : awayIndex += basketballWeights[9];
                homeTeam.avgDefensiveRebounds >= awayTeam.avgDefensiveRebounds ? homeIndex += basketballWeights[10] : awayIndex += basketballWeights[10];
                homeTeam.pace >= awayTeam.pace ? homeIndex += basketballWeights[11] : awayIndex += basketballWeights[11];
                return { homeIndex, awayIndex };
            }
            // Helper function to adjust indexes for baseball games
            function adjustBaseballStats(homeTeam, awayTeam, homeIndex, awayIndex) {
                homeTeam.seasonWinLoss.split("-")[0] >= awayTeam.seasonWinLoss.split("-")[0] ? homeIndex += baseballWeights[0] : awayIndex += baseballWeights[0];
                homeTeam.homeWinLoss.split("-")[0] >= awayTeam.awayWinLoss.split("-")[0] ? homeIndex += baseballWeights[1] : awayIndex += baseballWeights[1];
                homeTeam.pointDiff >= awayTeam.pointDiff ? homeIndex += baseballWeights[2] : awayIndex += baseballWeights[2];
                homeTeam.onBasePct >= awayTeam.onBasePct ? homeIndex += baseballWeights[3] : awayIndex += baseballWeights[3];
                homeTeam.sluggingPct >= awayTeam.sluggingPct ? homeIndex += baseballWeights[4] : awayIndex += baseballWeights[4];
                homeTeam.earnedRunAverage <= awayTeam.earnedRunAverage ? homeIndex += baseballWeights[5] : awayIndex += baseballWeights[5];
                homeTeam.strikeoutWalkRatio <= awayTeam.strikeoutWalkRatio ? homeIndex += baseballWeights[6] : awayIndex += baseballWeights[6];
                homeTeam.fieldingPercentage >= awayTeam.fieldingPercentage ? homeIndex += baseballWeights[7] : awayIndex += baseballWeights[7];
                homeTeam.stolenBasePercentage >= awayTeam.stolenBasePercentage ? homeIndex += baseballWeights[8] : awayIndex += baseballWeights[8];
                homeTeam.fieldingErrors <= awayTeam.fieldingErrors ? homeIndex += baseballWeights[9] : awayIndex += baseballWeights[9];
                homeTeam.qualityStarts >= awayTeam.qualityStarts ? homeIndex += baseballWeights[10] : awayIndex += baseballWeights[10];
                homeTeam.homeRuns >= awayTeam.homeRuns ? homeIndex += baseballWeights[11] : awayIndex += baseballWeights[11];
                return { homeIndex, awayIndex };
            }
            currentOdds.map(async (game) => {
                // Check if the game is in the future
                if (moment().isBefore(moment(game.commence_time))) {
                    let homeTeam = await Teams.findOne({ 'espnDisplayName': game.home_team });
                    let awayTeam = await Teams.findOne({ 'espnDisplayName': game.away_team });
                    let homeIndex = 0;
                    let awayIndex = 0;
                    if (homeTeam && awayTeam) {
                        // Sport-specific conditions
                        if (game.sport_key === 'americanfootball_nfl' || game.sport_key === 'americanfootball_ncaaf') {
                            // Apply various football statistics for the index calculation
                            ({ homeIndex, awayIndex } = adjustFootballStats(homeTeam, awayTeam, homeIndex, awayIndex));
                        }
                        else if (game.sport_key === 'icehockey_nhl') {
                            // Apply hockey-specific statistics
                            ({ homeIndex, awayIndex } = adjustHockeyStats(homeTeam, awayTeam, homeIndex, awayIndex));
                        }
                        else if (game.sport_key === 'basketball_nba') {
                            // Apply basketball-specific statistics
                            ({ homeIndex, awayIndex } = adjustBasketballStats(homeTeam, awayTeam, homeIndex, awayIndex));
                        }
                        else if (game.sport_key === 'baseball_mlb') {
                            // Apply baseball-specific statistics
                            ({ homeIndex, awayIndex } = adjustBaseballStats(homeTeam, awayTeam, homeIndex, awayIndex));
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
                    if(sport === game.sport){
                        await Odds.findOneAndUpdate({ 'id': game.id }, {
                            homeTeamIndex: homeIndex || 0,
                            awayTeamIndex: awayIndex || 0,
                            homeTeamStats: getCommonStats(homeTeam),
                            awayTeamStats: getCommonStats(awayTeam),
                        });
                    }
                    
                }
            });
        }
    }

    // Example usage for different sports
    const pastFootballGames = await PastGameOdds.find({ sport: 'football' });
    await trainSportModel('football', pastFootballGames);

    const pastBasketballGames = await PastGameOdds.find({ sport: 'basketball' });
    await trainSportModel('basketball', pastBasketballGames);

    // const pastBaseballGames = await PastGameOdds.find({ sport: 'baseball' });
    // await trainSportModel('baseball', pastBaseballGames);

    const pastHockeyGames = await PastGameOdds.find({ sport: 'hockey' });
    await trainSportModel('hockey', pastHockeyGames);



    console.log('CALCULATING WIN RATES and Implied Probability') //CLEANED AND FORMATTED
    let allPastGames = await PastGameOdds.find({})
    allPastGames.map(async (game) => {
        try {
            // Loop over all bookmakers
            await Promise.all(game.bookmakers.map(async (bookmaker) => {
                // Loop over all markets for each bookmaker
                await Promise.all(bookmaker.markets.map(async (market) => {
                    // Loop over all outcomes for each market
                    await Promise.all(market.outcomes.map(async (outcome) => {
                        // Perform the update using arrayFilters to target the correct outcome
                        if (outcome.price < 0) {
                            await PastGameOdds.findOneAndUpdate(
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
                            await PastGameOdds.findOneAndUpdate(
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
    currentOdds.map(async (game) => {
        // Pre-calculate win rates in a single loop
        let winRates = {
            overall: 0,
            homeTeam: 0,
            awayTeam: 0,
            league: 0,
            homeTeamGames: 0,
            awayTeamGames: 0,
            leagueGames: 0
        };

        allPastGames.forEach((pastGame) => {
            if (pastGame.predictionCorrect === true) {
                winRates.overall += 1;
            }
            if (pastGame.home_team === game.home_team || pastGame.away_team === game.home_team) {
                if (pastGame.predictionCorrect === true) {
                    winRates.homeTeam += 1;
                }
                winRates.homeTeamGames += 1;
            }
            if (pastGame.home_team === game.away_team || pastGame.away_team === game.away_team) {
                if (pastGame.predictionCorrect === true) {
                    winRates.awayTeam += 1;
                }
                winRates.awayTeamGames += 1;
            }
            if (pastGame.sport_key === game.sport_key) {
                if (pastGame.predictionCorrect === true) {
                    winRates.league += 1;
                }
                winRates.leagueGames += 1;
            }
        });

        // Calculate win rates safely
        const safeDivision = (numerator, denominator) => (denominator === 0 ? 0 : numerator / denominator);

        const overallWinRate = safeDivision(winRates.overall, allPastGames.length);
        const homeTeamWinRate = safeDivision(winRates.homeTeam, winRates.homeTeamGames);
        const awayTeamWinRate = safeDivision(winRates.awayTeam, winRates.awayTeamGames);
        const leagueWinRate = safeDivision(winRates.league, winRates.leagueGames);

        // For each game in currentOdds, update the winPercent
        let winRatesArray = [overallWinRate];
        if (homeTeamWinRate) winRatesArray.push(homeTeamWinRate);
        if (awayTeamWinRate) winRatesArray.push(awayTeamWinRate);
        if (leagueWinRate) winRatesArray.push(leagueWinRate);

        const winPercent = winRatesArray.reduce((sum, rate) => sum + rate, 0) / winRatesArray.length;

        await Odds.findOneAndUpdate({ 'id': game.id }, { winPercent });
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