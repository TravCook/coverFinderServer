const moment = require('moment')
const { Odds, PastGameOdds, UsaFootballTeam, BasketballTeam, BaseballTeam, HockeyTeam } = require('../../../models');
const db = require('../../../models_sql');
const { cleanStats, getCommonStats } = require('./retrieveTeamsandStats')
const removePastGames = async (currentOdds) => {
    for (let game of currentOdds) {

        // Check if the game is in the past based on commence_time
        if (new Date(game.commence_time) < new Date()) {
            const controller = new AbortController();  // Create the AbortController
            const signal = controller.signal;          // Get the signal from the controller
            if (game['homeTeamDetails.id'] && game['awayTeamDetails.id']) {
                try {
                    // Fetch home team schedule from ESPN API
                    let homeTeamSchedule = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${game['sportDetails.espnSport']}/${game['homeTeamDetails.espnLeague']}/teams/${game['homeTeamDetails.espnID']}/schedule`, { signal }, timeout = 10000);
                    let homeTeamSchedJSON = await homeTeamSchedule.json();
                    const gameTime = new Date(game.commence_time);
                    //find the event on the schedule
                    const event = homeTeamSchedJSON.events.find((event) => (event.name === `${game['awayTeamDetails.espnDisplayName']} at ${game['homeTeamDetails.espnDisplayName']}`
                        || event.shortName === `${game['awayTeamDetails.espnDisplayName']} @ ${game['homeTeamDetails.espnDisplayName']}`
                        || event.shortName === `${game['homeTeamDetails.espnDisplayName']} VS ${game['awayTeamDetails.espnDisplayName']}`)
                        && Math.abs(new Date(event.date) - gameTime) < 1000 * 60 * 90
                    );
                    if (event) {
                        if (event.competitions[0].status.type.completed === true) {
                            let homeScore, awayScore, predictionCorrect, winner
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
                            if (game.predictedWinner === 'home') {
                                predictionCorrect = winner === game.predictedWinner;
                            } else if (game.predictedWinner === 'away') {
                                predictionCorrect = winner === 'away';
                            }

                            await db.Games.update({
                                homeScore: homeScore,
                                awayScore: awayScore,
                                timeRemaining: null, // Set to null since the game is completed
                                predictionCorrect: predictionCorrect,
                                winner: winner,
                                complete: true,
                            }, {
                                where: {
                                    id: game.id
                                }
                            })

                        } else if (event.competitions[0].status.type.description === 'In Progress' || event.competitions[0].status.type.description === 'Halftime' || event.competitions[0].status.type.description === 'End of Period') {

                            let timeRemaining, homeScore, awayScore
                            let currentScoreboard = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${game['sportDetails.espnSport']}/${game['homeTeamDetails.espnLeague']}/scoreboard?dates=${moment(currentOdds[0].commence_time).format('YYYYMMDD')}-${moment(currentOdds[currentOdds.length - 1].commence_time).format('YYYYMMDD')}`, { signal }, timeout = 10000);
                            let scoreboardJSON = await currentScoreboard.json()
                            let SBevent = scoreboardJSON.events.find(ev => ev.id === event.id)
                            if (SBevent) {
                                if (Math.abs(moment(event.date).diff(gameTime, 'minutes')) <= 90 && (SBevent.name === `${game['awayTeamDetails.espnDisplayName']} at ${game['homeTeamDetails.espnDisplayName']}` || SBevent.shortName === `${game['awayTeamDetails.abbreviation']} @ ${game['homeTeamDetails.abbreviation']}`)) {
                                    // Determine the scores and winner
                                    SBevent.competitions[0].competitors.forEach((team) => {
                                        if (team.homeAway === 'home') {
                                            homeScore = parseInt(team.score); // home score
                                        } else if (team.homeAway === 'away') {
                                            awayScore = parseInt(team.score); // away score
                                        }
                                    });

                                    timeRemaining = SBevent.status.type.shortDetail
                                    try {
                                        await db.Games.update({
                                            homeScore: homeScore,
                                            awayScore: awayScore,
                                            timeRemaining: timeRemaining,
                                        }, {
                                            where: {
                                                id: game.id
                                            }
                                        })

                                    } catch (error) {
                                        console.error('Error updating game:', error);
                                    }

                                }


                            }
                        }
                        else if (event.competitions[0].status.type.description === 'Postponed') {
                            // await db.Games.destroy({
                            //     where: {
                            //         id: game.id
                            //     },

                            // })
                            console.log('Game Postponed:', game.id);
                            console.log(`${game['awayTeamDetails.espnDisplayName']} at ${game['homeTeamDetails.espnDisplayName']}`)
                            console.log(`https://site.api.espn.com/apis/site/v2/sports/${game.sport_title}/${game['homeTeamDetails.espnLeague']}/teams/${game['homeTeamDetails.espnID']}/schedule`)
                        }
                        // else if () {
                        //     await db.Games.update({
                        //         timeRemaining: null,

                        //     },{
                        //         where: {
                        //             id: game.id
                        //         },

                        //     })
                        // }
                    }
                    else {
                        // await db.Games.destroy({
                        //     where: {
                        //         id: game.id
                        //     },

                        // })
                        console.log ('No matching event found for game:', game.id);
                        console.log(`${game['awayTeamDetails.espnDisplayName']} at ${game['homeTeamDetails.espnDisplayName']}`)
                        console.log(`https://site.api.espn.com/apis/site/v2/sports/${game.sport_title}/${game['homeTeamDetails.espnLeague']}/teams/${game['homeTeamDetails.espnID']}/schedule`)
                    }
                } catch (err) {
                    console.log(game)
                    console.log(`${game['awayTeamDetails.espnDisplayName']} at ${game['homeTeamDetails.espnDisplayName']}`)
                    console.log(`https://site.api.espn.com/apis/site/v2/sports/${game.sport_title}/${game['homeTeamDetails.espnLeague']}/teams/${game['homeTeamDetails.espnID']}/schedule`)
                    console.log(err); // Log any errors encountered during the API call or processing
                    controller.abort();
                }
            } else {
                console.log(game.id)
                console.log(game)
            }

            homeTeam = null
            awayTeam = null

        }
    }
}

module.exports = { removePastGames }
