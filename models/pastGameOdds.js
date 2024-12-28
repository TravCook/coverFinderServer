const mongoose = require('mongoose')

const { Schema } = mongoose;

const pastGameOddsSchema = new Schema({
    id: {
        type: String,
        required: true,
        trim: true
    },
    sport_key: {
        type: String,
        required: true,
    },
    sport_key: {
        type: String,
        required: true
    },
    sport_title: {
        type: String,
        required: true
    },
    commence_time: {
        type: String,
        required: true
    },
    home_team: {
        type: String,
        required: true,
    },
    away_team: {
        type: String,
        required: true,
    },
    sport: {
        type: String,
        required: true
    },
    bookmakers: [
        {
            key: {
                type: String,
                required: true,
            },
            title: {
                type: String,
                required: true,
            },
            last_update: {
                type: Date,
                required: true,
            },
            markets: [
                {
                    key: {
                        type: String,
                        required: true,
                    },
                    outcomes: [
                        {
                            name: {
                                type: String,
                                required: true,
                            },
                            price: {
                                type: Number,
                                required: true,
                            },
                            impliedProb: {
                                type: Number,
                                required: false
                            }
                        }
                    ]
                }
            ]
        },
    ],
    homeTeamIndex: {
        type: Number,
        required: false
    },
    awayTeamIndex: {
        type: Number,
        required: false
    },
    winner: {
        type: String,
        required: true
    },
    homeScore: {
        type: Number,
        required: true
    },
    awayScore: {
        type: Number,
        required: true
    },
    winPercent: {
        type: Number,
        required: false
    },
    predictionCorrect: {
        type: Boolean,
        required: true
    },
    homeTeamStats: {
        seasonWinLoss: {
            type: String,
            required: true,
        },
        homeWinLoss: {
            type: String,
            required: true,
        },
        awayWinLoss: {
            type: String,
            required: true,
        },
        pointDiff: {
            type: Number,
            required: true
        },
        takeawaysPerGame: {
            type: Number,
            required: false,
        }, //USAFootball stat
        giveawaysPerGame: {
            type: Number,
            required: false,
        }, //USAFootball stat
        turnoverDiff: {
            type: Number,
            required: false,
        }, //USAFootball stat
        pointsPerGame: {
            type: Number,
            required: false
        }, //USAFootball stat
        yardsPerPlay: {
            type: Number,
            required: false,
        }, //USAFootball stat
        thirdDownConvRate: {
            type: Number,
            required: false,
        }, //USAFootball stat
        redZoneEfficiency: {
            type: Number,
            required: false,
        }, //USAFootball stat
        avgTimeofPossession: {
            type: Number,
            required: false,
        }, //USAFootball stat
        sackRate: {
            type: Number,
            required: false,
        }, //USAFootball stat
        completionPercentage: {
            type: Number,
            required: false,
        }, //USAFootball stat
        rushingYardsPerGame: {
            type: Number,
            required: false,
        }, //USAFootball stat
        yardsAllowedPerGame: {
            type: Number,
            required: false,
        }, //USAFootball stat
        penaltyYardsPerGame: {
            type: Number,
            required: false,
        }, //USAFootball stat
        powerPlayPct: {
            type: Number,
            required: false,
        },        // hockey stat
        penKillPct: {
            type: Number,
            required: false,
        },        // hockey stat
        shotsTaken: {
            type: Number,
            required: false,
        },        // hockey stat
        savePct: {
            type: Number,
            required: false,
        },        // hockey stat
        goalsforPerGame: {
            type: Number,
            required: false,
        },        // hockey stat
        faceoffsWon: {
            type: Number,
            required: false,
        },        // hockey stat
        goalsAgainstAverage: {
            type: Number,
            required: false,
        },        // hockey stat
        shootingPct: {
            type: Number,
            required: false,
        },        // hockey stat
        shotsBlocked: {
            type: Number,
            required: false,
        },       // hockey stat
        giveaways: {
            type: Number,
            required: false,
        },        // hockey stat
        takeaways: {
            type: Number,
            required: false,
        },      // hockey stat
        onBasePct: {
            type: Number,
            required: false,
        },      // baseball Stat
        sluggingPct: {
            type: Number,
            required: false,
        },      // baseball Stat
        earnedRunAverage: {
            type: Number,
            required: false,
        },      // baseball Stat
        strikeoutWalkRatio: {
            type: Number,
            required: false,
        },      // baseball Stat
        fieldingPercentage: {
            type: Number,
            required: false,
        },      // baseball Stat
        stolenBasePercentage: {
            type: Number,
            required: false,
        },      // baseball Stat
        fieldingErrors: {
            type: Number,
            required: false,
        },      // baseball Stat
        qualityStarts: {
            type: Number,
            required: false,
        },      // baseball Stat
        homeRuns: {
            type: Number,
            required: false,
        },      // baseball Stat
        effectiveFieldGoalPct: {
            type: Number,
            required: false,
        },      // basketball Stat
        turnoverDiff: {
            type: Number,
            required: false,
        },      // basketball Stat
        threePointPct: {
            type: Number,
            required: false,
        },      // basketball Stat
        avgOffensiveRebounds: {
            type: Number,
            required: false,
        },      // basketball Stat
        freeThrowPct: {
            type: Number,
            required: false,
        },      // basketball Stat
        assistTurnoverRatio: {
            type: Number,
            required: false,
        },      // basketball Stat
        pointsInPaint: {
            type: Number,
            required: false,
        },      // basketball Stat
        avgDefensiveRebounds: {
            type: Number,
            required: false,
        },      // basketball Stat
        pace: {
            type: Number,
            required: false,
        },      // basketball Stat
    },
    awayTeamStats: {
        seasonWinLoss: {
            type: String,
            required: true,
        },
        homeWinLoss: {
            type: String,
            required: true,
        },
        awayWinLoss: {
            type: String,
            required: true,
        },
        pointDiff: {
            type: Number,
            required: true
        },
        takeawaysPerGame: {
            type: Number,
            required: false,
        }, //USAFootball stat
        giveawaysPerGame: {
            type: Number,
            required: false,
        }, //USAFootball stat
        turnoverDiff: {
            type: Number,
            required: false,
        }, //USAFootball stat
        pointsPerGame: {
            type: Number,
            required: false
        }, //USAFootball stat
        yardsPerPlay: {
            type: Number,
            required: false,
        }, //USAFootball stat
        thirdDownConvRate: {
            type: Number,
            required: false,
        }, //USAFootball stat
        redZoneEfficiency: {
            type: Number,
            required: false,
        }, //USAFootball stat
        avgTimeofPossession: {
            type: Number,
            required: false,
        }, //USAFootball stat
        sackRate: {
            type: Number,
            required: false,
        }, //USAFootball stat
        completionPercentage: {
            type: Number,
            required: false,
        }, //USAFootball stat
        rushingYardsPerGame: {
            type: Number,
            required: false,
        }, //USAFootball stat
        yardsAllowedPerGame: {
            type: Number,
            required: false,
        }, //USAFootball stat
        penaltyYardsPerGame: {
            type: Number,
            required: false,
        }, //USAFootball stat
        powerPlayPct: {
            type: Number,
            required: false,
        },        // hockey stat
        penKillPct: {
            type: Number,
            required: false,
        },        // hockey stat
        shotsTaken: {
            type: Number,
            required: false,
        },        // hockey stat
        savePct: {
            type: Number,
            required: false,
        },        // hockey stat
        goalsforPerGame: {
            type: Number,
            required: false,
        },        // hockey stat
        faceoffsWon: {
            type: Number,
            required: false,
        },        // hockey stat
        goalsAgainstAverage: {
            type: Number,
            required: false,
        },        // hockey stat
        shootingPct: {
            type: Number,
            required: false,
        },        // hockey stat
        shotsBlocked: {
            type: Number,
            required: false,
        },       // hockey stat
        giveaways: {
            type: Number,
            required: false,
        },        // hockey stat
        takeaways: {
            type: Number,
            required: false,
        },      // hockey stat
        onBasePct: {
            type: Number,
            required: false,
        },      // baseball Stat
        sluggingPct: {
            type: Number,
            required: false,
        },      // baseball Stat
        earnedRunAverage: {
            type: Number,
            required: false,
        },      // baseball Stat
        strikeoutWalkRatio: {
            type: Number,
            required: false,
        },      // baseball Stat
        fieldingPercentage: {
            type: Number,
            required: false,
        },      // baseball Stat
        stolenBasePercentage: {
            type: Number,
            required: false,
        },      // baseball Stat
        fieldingErrors: {
            type: Number,
            required: false,
        },      // baseball Stat
        qualityStarts: {
            type: Number,
            required: false,
        },      // baseball Stat
        homeRuns: {
            type: Number,
            required: false,
        },      // baseball Stat
        effectiveFieldGoalPct: {
            type: Number,
            required: false,
        },      // basketball Stat
        turnoverDiff: {
            type: Number,
            required: false,
        },      // basketball Stat
        threePointPct: {
            type: Number,
            required: false,
        },      // basketball Stat
        avgOffensiveRebounds: {
            type: Number,
            required: false,
        },      // basketball Stat
        freeThrowPct: {
            type: Number,
            required: false,
        },      // basketball Stat
        assistTurnoverRatio: {
            type: Number,
            required: false,
        },      // basketball Stat
        pointsInPaint: {
            type: Number,
            required: false,
        },      // basketball Stat
        avgDefensiveRebounds: {
            type: Number,
            required: false,
        },      // basketball Stat
        pace: {
            type: Number,
            required: false,
        },      // basketball Stat
    }
})

const pastGameOdds = mongoose.model('pastGameOdds', pastGameOddsSchema)

module.exports = pastGameOdds