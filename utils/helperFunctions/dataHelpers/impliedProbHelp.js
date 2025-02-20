const moment = require('moment')
const { Odds } = require('../../../models');
const impliedProbCalc = (currentOdds) => {
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
}

module.exports = {impliedProbCalc}