const { parentPort, workerData } = require('worker_threads');
const math = require("mathjs");

function cosineSimilarity(v1, v2) {
    const users = new Set([...Object.keys(v1), ...Object.keys(v2)]);
    const vec1 = [];
    const vec2 = [];

    users.forEach(user => {
        vec1.push(v1[user] || 0);
        vec2.push(v2[user] || 0);
    });

    const dotProduct = vec1.reduce((sum, v, i) => sum + v * vec2[i], 0);
    const norm1 = Math.sqrt(vec1.reduce((sum, v) => sum + v * v, 0));
    const norm2 = Math.sqrt(vec2.reduce((sum, v) => sum + v * v, 0));
    return (norm1 && norm2) ? dotProduct / (norm1 * norm2) : 0;
}

function computeHybridSimilarity(b1, b2, alpha = 0.7) {
    const ratingSim = cosineSimilarity(b1, b2);

    const country1 = (bookMetadata[b1]?.country || []).filter(Boolean);
    const country2 = (bookMetadata[b2]?.country || []).filter(Boolean);

    const useCountry = country1.length > 0 && country2.length > 0;

    const hasCommonCountry = useCountry && country1.some(c1 => country2.includes(c1));
    const countryDiversity = useCountry ? (hasCommonCountry ? 0 : 1) : 0;

    const hybridScore = alpha * ratingSim + (1 - alpha) * countryDiversity;

    return hybridScore;
}

function cosineSimilarityCheck(v1, v2) {
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

const { booksChunk, bookVectors, bookMetadata } = workerData;
const partialMatrix = {};

for (const b1 of booksChunk) {
    const similarities = [];

    for (const b2 in bookVectors) {
        if (b1 !== b2) {
            const sim = computeHybridSimilarity(bookVectors[b1], bookVectors[b2]);
            if (sim > 0) similarities.push([b2, sim]);
        }
    }

    similarities.sort((a, b) => b[1] - a[1]);
    partialMatrix[b1] = Object.fromEntries(similarities);
    parentPort.postMessage({ type: 'log', msg: `Worker processed ${b1} book` });
}

parentPort.postMessage(partialMatrix);
