const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const mlWeightSchema = new Schema({
    league: {
        type: String,
        required: true
    },
    inputToHiddenWeights: {
        type: [[Number]],  // This defines an array of arrays of numbers
        required: true
    },
    hiddenToOutputWeights: {
        type: [[Number]],  // This defines an array of arrays of numbers
        required: true
    },
    featureImportanceScores: {
        type: [Number],  // Array of importance scores for each feature
        required: true
    }
});

const MLWeights = mongoose.model('MLWeights', mlWeightSchema);

module.exports = MLWeights;
