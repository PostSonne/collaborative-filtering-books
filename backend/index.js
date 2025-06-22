const express = require('express');
const fs = require('fs');
const csv = require('csv-parser');
const app = express();
const cors = require('cors');
const PORT = 3001;

let allRatings = [];
let trainRatings = [];
let testRatings = [];

let userBookTrain = {};
let userBookTest = {};

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
                        // Merge all parts
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

app.use(cors());

(async () => {
    await loadAndSplitRatings();
    await loadBookMetaData();
    await loadAuthorsData();
    await updateBookMetaData();
    await loadAndSplitRatings();

    //buildBookVectors();
    //await computeSimilarityMatrixParallel();
})();

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});