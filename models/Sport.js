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
    decayFactor: {
        type: Number,
        required: true
    },
    gameDecayThreshold: {
        type: Number,
        required: true
    },
    learningDecayFactor: {
        type: Number,
        required: true
    },
    epochs: {
        type: Number,
        required: true
    },
    batchSize: {
        type: Number,
        required: true
    },
    KFolds: {
        type: Number,
        required: true
    },
    hiddenLayerNum: {
        type: Number,
        required: true
    },
    learningRate: {
        type: Number,
        required: true
    },
    l2Reg: {
        type: Number,
        required: true
    },
    dropoutReg: {
        type: Number,
        required: true
    },
    kernalInitializer: {
        type: String,
        required: true
    },
    valueBetSettings: [{
        bookmaker: {
            type: String,
            required: true
        },
        settings: {
            winPercentIncrease: {
                type: Number,
                required: true
            },
            indexDiffSmallNum: {
                type: Number,
                required: true
            },
            indexDiffRangeNum: {
                type: Number,
                required: true
            },
            confidenceLowNum: {
                type: Number,
                required: true
            },
            confidenceRangeNum: {
                type: Number,
                required: true
            }
        }
    }]
});

const Sport = mongoose.model('Sport', sportSchema);

module.exports = Sport;
