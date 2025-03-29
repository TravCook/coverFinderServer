const moment = require('moment')
const { Odds, PastGameOdds, UsaFootballTeam, BasketballTeam, BaseballTeam, HockeyTeam } = require('../../../models');
const { cleanStats, getCommonStats } = require('./retrieveTeamsandStats')
const removePastGames = async (currentOdds) => {
    for (let game of currentOdds) {

        // Check if the game is in the past based on commence_time
        if (moment(game.commence_time).local().isBefore(moment().local())) {
            let { _id, ...newGame } = game._doc;

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


            const controller = new AbortController();  // Create the AbortController
            const signal = controller.signal;          // Get the signal from the controller
            if (homeTeam && awayTeam) {
                try {
                    // Fetch home team schedule from ESPN API
                    let homeTeamSchedule = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${game.sport}/${homeTeam.league}/teams/${homeTeam.espnID}/schedule`, { signal }, timeout = 10000);
                    let homeTeamSchedJSON = await homeTeamSchedule.json();
                    //find the event on the schedule
                    const event = homeTeamSchedJSON.events.find((event) => (event.name === `${awayTeam.espnDisplayName} at ${homeTeam.espnDisplayName}`
                        || event.shortName === `${awayTeam.abbreviation} @ ${homeTeam.abbreviation}`
                        || event.shortName === `${homeTeam.abbreviation} VS ${awayTeam.abbreviation}`)
                        && moment(event.date).isSame(moment(game.commence_time), 'day'))
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

                            let existingGame = await PastGameOdds.findOne({
                                home_team: homeTeam.espnDisplayName,
                                away_team: awayTeam.espnDisplayName,
                                commence_time: game.commence_time
                            });
                            // Save the past game to the PastGameOdds collection
                            // Check if the game already exists in the PastGameOdds collection
                            if (!existingGame) {
                                try {
                                    // Create a new record
                                    await PastGameOdds.create({
                                        ...newGame,
                                        homeScore,
                                        awayScore,
                                        winner,
                                        predictionCorrect: winner === game.predictedWinner,
                                        homeTeamStats: cleanStats(getCommonStats(homeTeam)),
                                        awayTeamStats: cleanStats(getCommonStats(awayTeam)),
                                    });

                                    // Delete the game from the Odds collection
                                    let deletedGame = await Odds.findOneAndDelete({ _id: game._doc._id });
                                    if (deletedGame) {
                                        console.log(`deleted game: ${deletedGame.home_team} vs ${deletedGame.away_team}`);
                                        deletedGame = null;  // Nullify reference after use
                                    }
                                } catch (error) {
                                    console.error("Error during database operation", error);
                                }
                            } else {
                                console.log('Game already exists in PastGameOdds');
                                // Delete the game from the Odds collection
                                let deletedGame = await Odds.findOneAndDelete({ _id: game._doc._id });
                                if (deletedGame) {
                                    console.log(`deleted game: ${deletedGame.home_team} vs ${deletedGame.away_team}`);
                                }
                                deletedGame = null
                            }

                            existingGame = null
                        } else if (event.competitions[0].status.type.description === 'In Progress' || event.competitions[0].status.type.description === 'Halftime' || event.competitions[0].status.type.description === 'End of Period') {
                            let timeRemaining, homeScore, awayScore
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
                            deletedGame = null
                        }
                    } else {
                        // Delete the game from the Odds collection
                        // let deletedGame = await Odds.findOneAndDelete({ _id: game._doc._id });
                        // if (deletedGame) {
                            console.log(`deleted game: ${deletedGame.home_team} vs ${deletedGame.away_team} for not existing`);
                        // }
                        // deletedGame = null
                    }
                } catch (err) {
                    console.log(game.id)
                    console.log(err); // Log any errors encountered during the API call or processing
                    controller.abort();
                }
            } else {
                console.log(game.id)
            }

            homeTeam = null
            awayTeam = null

        }
    }
}

module.exports = { removePastGames }