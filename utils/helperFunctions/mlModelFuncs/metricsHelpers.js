const db = require('../../../models_sql');
const statsMinMax = require('../../seeds/sampledGlobalStats.json')
const fs = require('fs')
const path = require('path');
const tf = require('@tensorflow/tfjs');
const moment = require('moment')
const cliProgress = require('cli-progress');
const { baseballStatMap, basketballStatMap, footballStatMap, hockeyStatMap, statConfigMap } = require('../../statMaps')

function avg(arr) {
    return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

const evaluateMetrics = (ysTensor, yPredTensor) => {

    const yPredBool = yPredTensor.greaterEqual(0.5);  // Threshold predictions
    const ysTensorBool = ysTensor.cast('bool');       // Use ground-truth labels as-is

    // Convert tensors to arrays for easier manipulation
    const truePositives = tf.sum(tf.logicalAnd(ysTensorBool, yPredBool)).arraySync();
    const falsePositives = tf.sum(tf.logicalAnd(tf.logicalNot(ysTensorBool), yPredBool)).arraySync();
    const falseNegatives = tf.sum(tf.logicalAnd(ysTensorBool, tf.logicalNot(yPredBool))).arraySync();
    const trueNegatives = tf.sum(tf.logicalAnd(tf.logicalNot(ysTensorBool), tf.logicalNot(yPredBool))).arraySync();

    // console.log('truePositives', truePositives)
    // console.log('falsePositives', falsePositives)
    // console.log('falseNegatives', falseNegatives)
    // console.log('trueNegatives', trueNegatives)

    // Calculate precision, recall, and F1-score
    const precision = (truePositives + falsePositives > 0) ? truePositives / (truePositives + falsePositives) : 0;
    const recall = (truePositives + falseNegatives > 0) ? truePositives / (truePositives + falseNegatives) : 0;
    const f1Score = (precision + recall > 0) ? 2 * (precision * recall) / (precision + recall) : 0;


    return {
        precision: precision,
        recall: recall,
        f1Score: f1Score,
        truePositives: truePositives,
        falsePositives: falsePositives,
        trueNegatives: trueNegatives,
        falseNegatives: falseNegatives
    };
}

function evaluateRegressionMetrics(yTrueTensor, yPredTensor) {
    const diff = tf.sub(yTrueTensor, yPredTensor);
    const squared = tf.square(diff);
    const abs = tf.abs(diff);

    const mse = tf.mean(squared).arraySync();
    const mae = tf.mean(abs).arraySync();

    return {
        mse,
        rmse: Math.sqrt(mse),
        mae
    };
}

function evaluateFoldMetrics(testXs, testYsScore, scorePreds, winProbPreds) {
    const testXsTensor = tf.tensor2d(testXs);
    const testYsScoreTensor = tf.tensor2d(testYsScore, [testYsScore.length, 1]);
    // const testYsWinsTensor = tf.tensor2d(testYsWins, [testYsWins.length, 1]);
    const scorePredsTensor = tf.tensor2d(scorePreds, [scorePreds.length, 1]);
    // const winPredsTensor = tf.tensor2d(winProbPreds, [winProbPreds.length, 1]);

    // const metrics = evaluateMetrics(testYsWinsTensor, winPredsTensor);
    const regressionMetrics = evaluateRegressionMetrics(testYsScoreTensor, scorePredsTensor);

    testXsTensor.dispose();
    testYsScoreTensor.dispose();
    // testYsWinsTensor.dispose();
    scorePredsTensor.dispose();
    // winPredsTensor.dispose();

    return {
        mse: regressionMetrics.mse,
        rmse: regressionMetrics.rmse,
        mae: regressionMetrics.mae,
        // ...metrics,
    };
}

function printOverallMetrics(foldResults) {
    const avgF1 = avg(foldResults.map(f => f.f1Score));
    const avgMAE = avg(foldResults.map(f => f.mae));
    const avgSpreadMAE = foldResults.reduce((acc, f) => acc + f.spreadMAE, 0) / foldResults.length;
    const avgTotalMAE = foldResults.reduce((acc, f) => acc + f.totalMAE, 0) / foldResults.length;




    const totalCounts = ['truePositives', 'falsePositives', 'trueNegatives', 'falseNegatives'].reduce((acc, key) => {
        acc[key] = foldResults.reduce((sum, f) => sum + f[key], 0);
        return acc;
    }, {});

    const total = Object.values(totalCounts).reduce((sum, val) => sum + val, 0);

    // console.log(`--- Overall Performance Avg F1-Score: ${avgF1.toFixed(4)} ---`);
    // for (const [label, count] of Object.entries(totalCounts)) {
    //     console.log(`${label}: ${count} (${((count / total) * 100).toFixed(2)}%)`);
    // }
    console.log(`Average Spread MAE: ${avgSpreadMAE.toFixed(2)}`);
    console.log(`Average Total MAE: ${avgTotalMAE.toFixed(2)}`);
    // console.log(`--- Overall Performance Avg MAE: ${avgMAE.toFixed(4)} ---`);
    return {avgSpreadMAE, avgTotalMAE, avgMAE, totalCounts}
}

module.exports = { evaluateFoldMetrics, printOverallMetrics }