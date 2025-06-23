const express = require('express');
const fs = require('fs');
const csv = require('csv-parser');
const math = require('mathjs');
const { Worker } = require('worker_threads');
const { getCountriesForAuthors } = require('./authorCountry');
const os = require('os');
const app = express();
const cors = require('cors');
const PORT = 3001;
const k = 20;

let allRatings = [];
let trainRatings = [];
let testRatings = [];

let userBookTrain = {};
let userBookTest = {};
let bookVectors = {};
let similarityMatrix = {};
let similarityMatrix07 = {};
let similarityWithoutMatrix = {};
let bookMetadata = {};
let fullBookMetadata = {};
let authors = {};

app.use(cors());

function loadSimilarityMatrix() {
    return new Promise((resolve, reject) => {
        fs.readFile('similarities08.json', 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading the file:', err);
                return;
            }

            try {
                similarityMatrix = JSON.parse(data);
            } catch (parseErr) {
                console.error('Error parsing JSON:', parseErr);
            }
            resolve();
        });
    });
}
function loadSimilarityMatrix08() {
    return new Promise((resolve, reject) => {
        fs.readFile('similarities08.json', 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading the file:', err);
                return;
            }

            try {
                similarityMatrix = JSON.parse(data);
            } catch (parseErr) {
                console.error('Error parsing JSON:', parseErr);
            }
            resolve();
        });
    });
}
function loadSimilarityMatrix07() {
    return new Promise((resolve, reject) => {
        fs.readFile('similarities07.json', 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading the file:', err);
                return;
            }

            try {
                similarityMatrix07 = JSON.parse(data);
            } catch (parseErr) {
                console.error('Error parsing JSON:', parseErr);
            }
            resolve();
        });
    });
}
function loadSimilarityWithoutMatrix() {
    return new Promise((resolve, reject) => {
        fs.readFile('similaritiesWithout.json', 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading the file:', err);
                return;
            }

            try {
                similarityWithoutMatrix = JSON.parse(data);
            } catch (parseErr) {
                console.error('Error parsing JSON:', parseErr);
            }
            resolve();
        });
    });
}

function loadBookMetaData() {
    return new Promise((resolve, reject) => {
        fs.readFile('bookMetadata.json', 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading the file:', err);
                return;
            }

            try {
                bookMetadata = JSON.parse(data);
                fullBookMetadata = JSON.parse(data);

                bookMetadata = Object.fromEntries(
                    Object.entries(bookMetadata).filter(([bookId, book]) =>
                        book.country?.some(c => c !== null)
                    )
                );
            } catch (parseErr) {
                console.error('Error parsing JSON:', parseErr);
            }
            resolve();
        });
    });
}

function loadAuthorsData() {
    return new Promise((resolve, reject) => {
        fs.readFile('authors.json', 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading the file:', err);
                return;
            }

            try {
                authors = JSON.parse(data);
            } catch (parseErr) {
                console.error('Error parsing JSON:', parseErr);
            }
            resolve();
        });
    });
}

function updateBookMetaData() {
    return new Promise((resolve, reject) => {
        fs.createReadStream('books.csv')
            .pipe(csv())
            .on('data', (row) => {
                const id = row['id'];
                const authors = row['authors'];
                const title = row['original_title'];
                const titleAlt = row['title'];
                const image_url = row['image_url'];
                const average_rating = row['average_rating'];
                bookMetadata[id] = {authors: authors, originalTitle: title || titleAlt, image: image_url, average_rating: average_rating};
            })
            .on('end', async () => {
                const allBooks = Object.keys(bookMetadata);

                for (let i = 0; i < allBooks.length; i++) {
                    const bookId = allBooks[i];
                    const {authors: authorStr} = bookMetadata[bookId];
                    const names = authorStr.split(',').map(name => name.trim());

                    const allKnown = names.every(name => authors[name]?.country !== undefined);
                    if (allKnown) {
                        bookMetadata[bookId].country = names.map(name => authors[name].country);
                        fs.writeFileSync('bookMetadata.json', JSON.stringify(bookMetadata, null, 2));
                        console.log(`Skipped ${bookId} (cached)`);
                        continue;
                    }

                    try {
                        const res = await getCountriesForAuthors(authorStr);
                        bookMetadata[bookId].country = res.countries;

                        names.forEach((name, idx) => {
                            authors[name] = {country: res.countries[idx]};
                        });

                        fs.writeFileSync('bookMetadata.json', JSON.stringify(bookMetadata, null, 2));
                        fs.writeFileSync('authors.json', JSON.stringify(authors, null, 2));

                        console.log(`Processed: ${bookId}`);
                    } catch (err) {
                        console.error(`Error processing ${bookId}: ${err.message}`);
                    }

                }
                resolve();
            });
    });
}

function loadAndSplitRatings() {
    return new Promise((resolve, reject) => {
        fs.createReadStream('ratings.csv')
            .pipe(csv())
            .on('data', (row) => {
                const userId = row['user_id'];
                const bookId = row['book_id'];
                const rating = parseFloat(row['rating']);
                allRatings.push({ userId, bookId, rating });
            })
            .on('end', () => {
                const userRatingsMap = {};

                allRatings.forEach(({ userId, bookId, rating }) => {
                    if (!userRatingsMap[userId]) userRatingsMap[userId] = [];
                    userRatingsMap[userId].push({ bookId, rating });
                });

                Object.entries(userRatingsMap).forEach(([userId, ratings]) => {
                    if (ratings.length < 2) return; // Skip users with < 2 ratings

                    const shuffled = ratings.sort(() => Math.random() - 0.5);
                    const splitIdx = Math.floor(shuffled.length * 0.8);
                    const trainSet = shuffled.slice(0, splitIdx);
                    const testSet = shuffled.slice(splitIdx);

                    trainSet.forEach(({ bookId, rating }) => {
                        if (!userBookTrain[userId]) userBookTrain[userId] = {};
                        userBookTrain[userId][bookId] = rating;
                        trainRatings.push({ userId, bookId, rating });
                    });

                    testSet.forEach(({ bookId, rating }) => {
                        if (!userBookTest[userId]) userBookTest[userId] = {};
                        userBookTest[userId][bookId] = rating;
                        testRatings.push({ userId, bookId, rating });
                    });
                });

                fs.writeFileSync('userBookTrain.json', JSON.stringify(userBookTrain));
                fs.writeFileSync('trainRatings.json', JSON.stringify(trainRatings));
                fs.writeFileSync('userBookTest.json', JSON.stringify(userBookTest));
                fs.writeFileSync('testRatings.json', JSON.stringify(testRatings));

                resolve();
            });
    });
}

function buildBookVectors() {
    const bookRatings = {};

    trainRatings.forEach(({ userId, bookId, rating }) => {
        if (!bookRatings[bookId]) bookRatings[bookId] = {};
        bookRatings[bookId][userId] = rating;
    });

    Object.entries(bookRatings).forEach(([bookId, userRatings]) => {
        bookVectors[bookId] = userRatings;
    });
}

function cosineSimilarity(v1, v2) {
    const users = new Set([...Object.keys(v1), ...Object.keys(v2)]);
    const vec1 = [];
    const vec2 = [];

    users.forEach(user => {
        vec1.push(v1[user] || 0);
        vec2.push(v2[user] || 0);
    });

    const dotProduct = math.dot(vec1, vec2);
    const norm1 = math.norm(vec1);
    const norm2 = math.norm(vec2);

    return (norm1 && norm2) ? dotProduct / (norm1 * norm2) : 0;
}

function computeSimilarityMatrixParallel() {
    return new Promise((resolve, reject) => {
        const cpuCount = os.cpus().length;
        const allBooks = Object.keys(bookVectors);
        const chunkSize = Math.ceil(allBooks.length / cpuCount);
        const chunks = [];

        for (let i = 0; i < allBooks.length; i += chunkSize) {
            chunks.push(allBooks.slice(i, i + chunkSize));
        }

        const results = [];
        let completed = 0;

        chunks.forEach((booksChunk, i) => {
            const worker = new Worker('./similarityWorker.js', {
                workerData: {
                    booksChunk,
                    bookVectors,
                    bookMetadata
                }
            });

            worker.on('message', (data) => {
                if (data.type === 'log') {
                    console.log(`[Worker] ${data.msg}`);
                } else {
                    results.push(data);
                    completed++;
                    if (completed === chunks.length) {
                        similarityMatrix = Object.assign({}, ...results);
                        fs.writeFileSync('similarities07.json', JSON.stringify(similarityMatrix));
                        console.log('Similarity matrix built in parallel.');
                        resolve();
                    }
                }
            });

            worker.on('error', reject);
            worker.on('exit', (code) => {
                if (code !== 0)
                    reject(new Error(`Worker stopped with exit code ${code}`));
            });
        });
    });
}

function predictRating(userId, targetBookId, matrix = similarityMatrix) {
    const ratedBooks = userBookTrain[userId];
    if (!ratedBooks) return null;

    const similarities = matrix[targetBookId];
    if (!similarities) return null;

    let numerator = 0;
    let denominator = 0;
    let i = 0;
    let count = 0;

    const ratedSimilarities = Object.entries(ratedBooks)
        .map(([bookId, rating]) => {
            const sim = similarities[bookId];
            return (sim !== undefined)
                //? { bookId, sim, ratingDiff: rating - Number(itemAvg) }
                ? { bookId, sim, rating: rating }
                : null;
        })
        .filter(Boolean);

    const topK = ratedSimilarities
        .sort((a, b) => Math.abs(b.sim) - Math.abs(a.sim))
        .slice(0, k);

    topK.forEach(({ sim, rating }) => {
        numerator += sim * rating;
        denominator += Math.abs(sim);
    });

    if (topK.length < 3) return null;

    const rawPrediction = numerator / denominator;
    //const prediction = Math.max(0, Math.min(5, rawPrediction)); // clamp

    return rawPrediction;
}

function evaluatePredictions(userId, matrix = similarityMatrix) {
    const userTestRatings = testRatings.filter(r => r.userId === userId);
    const results = {
        predictions: [],
        recommended: [],
        recommendedWithout: []
    };

    userTestRatings.filter(({ bookId }) => {
        const countries = bookMetadata[bookId]?.country;
        return Array.isArray(countries) && countries.some(c => c !== null);
    }).forEach(({ bookId, rating }) => {
        const predicted = predictRating(userId, bookId, matrix);
        if (predicted !== null) {
            results.predictions.push({
                bookId,
                title: bookMetadata[bookId]?.originalTitle ||  'Unknown Title',
                actualRating: rating,
                predictedRating: parseFloat(predicted.toFixed(2)),
                country: bookMetadata[bookId]?.country,
                image: bookMetadata[bookId].image
            });
        }
    });

    const ratedBooks = new Set(Object.keys(userBookTrain[userId] || {}));
    const allBooks = Object.keys(bookMetadata);

    const predictionsForUnrated = [];
    const predictionsForUnratedWithout = [];

    allBooks.filter( bookId  => {
        const countries = bookMetadata[bookId]?.country;
        return Array.isArray(countries) && countries.some(c => c !== null);
    }).forEach(bookId => {
        if (!ratedBooks.has(bookId)) {
            const predicted = predictRating(userId, bookId, matrix);
            const predictedWithout = predictRating(userId, bookId, similarityWithoutMatrix);
            if (predicted !== null) {
                predictionsForUnrated.push({
                    bookId,
                    title: bookMetadata[bookId]?.originalTitle || 'Unknown Title',
                    predictedRating: parseFloat(predicted.toFixed(2)),
                    country: bookMetadata[bookId]?.country,
                    image: bookMetadata[bookId].image
                });
            }

            if (predictedWithout !== null) {
                predictionsForUnratedWithout.push({
                    bookId,
                    title: bookMetadata[bookId]?.originalTitle || 'Unknown Title',
                    predictedRating: parseFloat(predictedWithout.toFixed(2)),
                    country: bookMetadata[bookId]?.country,
                    image: bookMetadata[bookId].image
                });
            }
        }
    });

    predictionsForUnrated.sort((a, b) => b.predictedRating - a.predictedRating);
    predictionsForUnratedWithout.sort((a, b) => b.predictedRating - a.predictedRating);
    results.recommended = predictionsForUnrated.slice(0, 20);
    results.recommendedWithout = predictionsForUnratedWithout.slice(0, 20);

    return results;
}

// Prepare model
(async () => {
    await loadAndSplitRatings();
    await loadBookMetaData();
    await loadAuthorsData();
    await loadSimilarityMatrix();
    await loadSimilarityMatrix07();
    await loadSimilarityWithoutMatrix();
    //await updateBookMetaData();
    //buildBookVectors();
    //await computeSimilarityMatrixParallel();
    console.log('Model is trained using 80% data');
})();

app.get('/predict/:userId', (req, res) => {
    const userId = req.params.userId;
    const predictions = evaluatePredictions(userId);
    res.json(predictions);
});

app.get('/predict07/:userId', (req, res) => {
    const userId = req.params.userId;
    const predictions = evaluatePredictions(userId, similarityMatrix07);
    res.json(predictions);
});

app.get('/ratings', (req, res) => {
    const userCounts = {};

    allRatings.forEach(({ userId }) => {
        if (!userCounts[userId]) userCounts[userId] = 0;
        userCounts[userId]++;
    });

    const sortedUserIds = Object.entries(userCounts)
        .sort((a, b) => b[1] - a[1])  // Sort descending by rating count
        .map(([userId]) => userId);

    res.json(sortedUserIds.slice(0, 20));
});

app.get('/countries', (req, res) => {
    const countriesCount = {};

    for (const book of Object.values(bookMetadata)) {
        const countries = book.country || [];
        for (const country of countries) {
            if (!countriesCount[country]) countriesCount[country] = 0;
            countriesCount[country]++;
        }
    }

    const sorted = Object.entries(countriesCount)
        .sort((a, b) => b[1] - a[1])  // Sort by count descending
        .map(([country, count]) => ({ country, count }));

    res.json(sorted);
});

function evaluateModel(matrix = similarityMatrix) {
    let totalError = 0;
    let totalSquaredError = 0;
    let totalPredictions = 0;

    for (const { userId, bookId, rating: actualRating } of testRatings) {
        const predicted = predictRating(userId, bookId, matrix);

        if (predicted !== null) {
            const error = predicted - actualRating;
            totalError += Math.abs(error);
            totalSquaredError += error * error;
            totalPredictions++;
        }
    }

    const mae = totalError / totalPredictions;
    const rmse = Math.sqrt(totalSquaredError / totalPredictions);
    const coverage = totalPredictions / testRatings.length;

    return {
        totalPredictions,
        totalTestRatings: testRatings.length,
        coverage: parseFloat((coverage * 100).toFixed(2)) + '%',
        MAE: parseFloat(mae.toFixed(4)),
        RMSE: parseFloat(rmse.toFixed(4))
    };
}

app.get('/evaluate', (req, res) => {
    const results = evaluateModel();
    res.json(results);
});

app.get('/evaluate07', (req, res) => {
    const results = evaluateModel(similarityMatrix07);
    res.json(results);
});

app.get('/evaluate_without', (req, res) => {
    const results = evaluateModel(similarityWithoutMatrix);
    res.json(results);
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

