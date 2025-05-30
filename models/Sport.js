const mongoose = require('mongoose');
const { Schema } = mongoose;

const sportSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    espnSport: {
        type: String,
        required: true
    },
    league: {
        type: String,
        required: true
    },
    startMonth: {
        type: Number,
        required: true
    },
    endMonth: {
        type: Number,
        required: true
    },
    multiYear: {
        type: Boolean,
        required: true
    },
    statYear: {
        type: Number,
        required: true
    },
    prevstatYear: {
        type: Number,
        required: true
    },
    indexGames: {
        type: Number, 
        required: false
    },
    sigmoidIQRSharpness: {
        type: Number,
        required: false
    },
    averageIndex: {
        type: Number,
        required: false
    },
    hyperParameters: {
        bestAccuracy: {
            type: Number,
            required: false
        },
        decayFactor: {
            type: Number,
            required: false
        },
        gameDecayThreshold: {
            type: Number,
            required: false
        },
        learningDecayFactor: {
            type: Number,
            required: false
        },
        epochs: {
            type: Number,
            required: false
        },
        batchSize: {
            type: Number,
            required: false
        },
        KFolds: {
            type: Number,
            required: false
        },
        hiddenLayerNum: {
            type: Number,
            required: false
        },
        learningRate: {
            type: Number,
            required: false
        },
        l2Reg: {
            type: Number,
            required: false
        },
        dropoutReg: {
            type: Number,
            required: false
        },
        kernalInitializer: {
            type: String,
            required: false
        },
        layerNeurons: {
            type: Number,
            required: false
        }
    },
    valueBetSettings: [{
        bookmaker: {
            type: String,
            required: false
        },
        settings: {
            // winPercentIncrease: {
            //     type: Number,
            //     required: false
            // },
            indexDiffSmallNum: {
                type: Number,
                required: false
            },
            indexDiffRangeNum: {
                type: Number,
                required: false
            },
            confidenceLowNum: {
                type: Number,
                required: false
            },
            confidenceRangeNum: {
                type: Number,
                required: false
            },
            bestWinrate : {
                type: Number,
                required: false
            },
            bestWeightScore: {
                type: Number,
                required: false
            },
            bestTotalGames: {
                type: Number,
                required: false
            },
            bestConfidenceInterval: {
                upper: {
                    type: Number,
                    required: false
                },
                lower: {
                    type: Number,
                    required: false
                }
            }
        }
    }]
});

const Sport = mongoose.model('Sport', sportSchema);

module.exports = Sport;
