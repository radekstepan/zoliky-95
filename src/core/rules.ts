import { ICard, MeldResult, Rank, Suit } from "../types";
import { RANKS, SUITS } from "./Card";

/**
 * Sorts a hand: Suit then Rank.
 */
export function sortHandLogic(hand: ICard[]): void {
    hand.sort((a, b) => {
        const suitIdxA = SUITS.indexOf(a.suit);
        const suitIdxB = SUITS.indexOf(b.suit);
        if (suitIdxA !== suitIdxB) return suitIdxA - suitIdxB;
        return a.getOrder() - b.getOrder();
    });
}

function getRankValue(rank: Rank, isAceLow: boolean): number {
    if (rank === 'A') return isAceLow ? 1 : 10;
    if (['J', 'Q', 'K'].includes(rank)) return 10;
    return parseInt(rank, 10) || 0;
}

export function organizeMeld(cards: ICard[]): ICard[] {
    const validRes = validateMeld(cards);
    if (!validRes.valid || !validRes.type) return cards;

    // Detect collision: If a real card exists that matches a Joker's representation,
    // we MUST reset that Joker's representation so it can be recalculated (moved to end/start).
    const nonJokers = cards.filter(c => !c.isJoker);
    cards.filter(c => c.isJoker).forEach(j => {
        if (j.representation) {
            const collision = nonJokers.some(real => 
                real.rank === j.representation!.rank && 
                real.suit === j.representation!.suit
            );
            if (collision) j.representation = undefined;
        }
    });

    // DON'T clear existing representations - preserve Joker positions
    const jokers = cards.filter(c => c.isJoker);
    // Note: jokers list needs to be re-evaluated for those with/without rep after collision check above
    const jokersWithRep = jokers.filter(j => j.representation !== undefined);
    const jokersWithoutRep = jokers.filter(j => j.representation === undefined);

    if (validRes.type === 'set') {
        const rank = nonJokers[0].rank;
        const usedSuits = new Set(nonJokers.map(c => c.suit));

        // Also mark suits used by Jokers with existing representations
        jokersWithRep.forEach(j => {
            if (j.representation) usedSuits.add(j.representation.suit);
        });

        const allSuits: Suit[] = ['♥', '♦', '♣', '♠'];

        // Only assign representations to Jokers that don't have them
        let jokerIdx = 0;
        for (const s of allSuits) {
            if (!usedSuits.has(s) && jokerIdx < jokersWithoutRep.length) {
                jokersWithoutRep[jokerIdx].representation = { rank: rank, suit: s };
                jokerIdx++;
            }
        }

        const combined = [...nonJokers, ...jokers];
        combined.sort((a, b) => {
            const sA = a.representation?.suit || a.suit;
            const sB = b.representation?.suit || b.suit;
            return SUITS.indexOf(sA) - SUITS.indexOf(sB);
        });
        return combined;
    }

    if (validRes.type === 'run') {
        const hasAce = nonJokers.some(c => c.rank === 'A');
        let isAceLow = false;
        if (hasAce) {
            const lowRanks = ['2', '3', '4', '5'];
            if (nonJokers.some(c => lowRanks.includes(c.rank))) isAceLow = true;
        }

        nonJokers.sort((a, b) => {
            let oa = a.getOrder();
            let ob = b.getOrder();
            if (isAceLow) {
                if (a.rank === 'A') oa = -1;
                if (b.rank === 'A') ob = -1;
            }
            return oa - ob;
        });

        // CRITICAL FIX: Ensure valid connectivity.
        let gapsToFill = 0;
        const getRawIdx = (c: ICard) => {
             if (isAceLow && c.rank === 'A') return -1;
             return RANKS.indexOf(c.rank);
        };
        
        for (let i = 0; i < nonJokers.length - 1; i++) {
            const idxA = getRawIdx(nonJokers[i]);
            const idxB = getRawIdx(nonJokers[i+1]);
            const diff = idxB - idxA;
            if (diff > 1) {
                gapsToFill += (diff - 1);
            }
        }

        if (gapsToFill > jokersWithoutRep.length) {
            jokers.forEach(j => j.representation = undefined);
            jokersWithRep.length = 0;
            jokersWithoutRep.length = 0;
            jokersWithoutRep.push(...jokers);
        }

        const suit = nonJokers[0].suit;

        const getRankIdx = (c: ICard) => {
            if (isAceLow && c.rank === 'A') return -1;
            return RANKS.indexOf(c.rank);
        };
        const getRankFromIdx = (idx: number): Rank => {
            if (idx === -1) return 'A';
            return RANKS[idx];
        };

        const allCardsInSequence: Array<{ card: ICard, idx: number, isJoker: boolean }> = [];

        nonJokers.forEach(c => {
            allCardsInSequence.push({ card: c, idx: getRankIdx(c), isJoker: false });
        });

        jokersWithRep.forEach(j => {
            if (j.representation) {
                const idx = getRankIdx({ rank: j.representation.rank, getOrder: () => RANKS.indexOf(j.representation!.rank) } as ICard);
                allCardsInSequence.push({ card: j, idx: idx, isJoker: true });
            }
        });

        allCardsInSequence.sort((a, b) => a.idx - b.idx);

        const finalSeq: ICard[] = [];
        let availableJokers = [...jokersWithoutRep];

        for (let i = 0; i < allCardsInSequence.length; i++) {
            const item = allCardsInSequence[i];

            if (i === 0) {
                finalSeq.push(item.card);
            } else {
                const prevItem = allCardsInSequence[i - 1];
                const diff = item.idx - prevItem.idx;

                if (diff > 1) {
                    const needed = diff - 1;
                    for (let k = 0; k < needed; k++) {
                        if (availableJokers.length > 0) {
                            const j = availableJokers.shift()!;
                            const repRankIdx = prevItem.idx + 1 + k;
                            j.representation = { rank: getRankFromIdx(repRankIdx), suit: suit };
                            finalSeq.push(j);
                        }
                    }
                }
                finalSeq.push(item.card);
            }
        }

        // Handle remaining Jokers (add to ends)
        const currentStart = allCardsInSequence.length > 0 ? allCardsInSequence[0].idx : 0;
        const currentEnd = allCardsInSequence.length > 0 ? allCardsInSequence[allCardsInSequence.length - 1].idx : 0;

        while (availableJokers.length > 0) {
            const j = availableJokers.shift()!;
            // currentEnd tracks the index of the last *original* item.
            // finalSeq.length grows as we add jokers.
            const nextIdx = currentEnd + (finalSeq.length - allCardsInSequence.length);

            // FIX: Ensure we don't exceed RANKS length. nextIdx is the current last index.
            // We want to add at nextIdx + 1. So nextIdx + 1 must be valid (< RANKS.length).
            if (nextIdx + 1 < RANKS.length) {
                j.representation = { rank: getRankFromIdx(nextIdx + 1), suit: suit };
                finalSeq.push(j);
            } else {
                const firstIdx = currentStart;
                const prevIdx = firstIdx - 1;
                if (prevIdx >= -1) {
                    j.representation = { rank: getRankFromIdx(prevIdx), suit: suit };
                    finalSeq.unshift(j);
                } else {
                    finalSeq.push(j);
                }
            }
        }

        return finalSeq;
    }
    return cards;
}

export function validateMeld(cards: ICard[]): MeldResult {
    const jokerCount = cards.filter(c => c.isJoker).length;
    const nonJokers = cards.filter(c => !c.isJoker);

    if (cards.length < 3) return { valid: false, points: 0 };

    // 1. Set Check
    if (nonJokers.length > 0) {
        const firstRank = nonJokers[0].rank;
        const isSet = nonJokers.every(c => c.rank === firstRank);
        if (isSet) {
            if (cards.length > 4) return { valid: false, points: 0 };
            const suits = nonJokers.map(c => c.suit);
            const uniqueSuits = new Set(suits);
            if (uniqueSuits.size !== suits.length) return { valid: false, points: 0 };

            const val = getRankValue(firstRank, false);
            return { valid: true, points: val * cards.length, type: 'set', isPure: jokerCount === 0 };
        }
    }

    // 2. Run Check
    if (nonJokers.length > 0) {
        const firstSuit = nonJokers[0].suit;
        const isSameSuit = nonJokers.every(c => c.suit === firstSuit);
        if (isSameSuit) {
            const trySequence = (treatAceLow: boolean): MeldResult => {
                const sorted = [...nonJokers].sort((a, b) => {
                    let oa = a.getOrder();
                    let ob = b.getOrder();
                    if (treatAceLow) {
                        if (a.rank === 'A') oa = -1;
                        if (b.rank === 'A') ob = -1;
                    }
                    return oa - ob;
                });

                let gaps = 0;
                let points = 0;
                points += nonJokers.reduce((acc, c) => acc + getRankValue(c.rank, treatAceLow), 0);

                const getIdx = (c: ICard) => {
                    if (treatAceLow && c.rank === 'A') return -1;
                    return RANKS.indexOf(c.rank);
                };

                for (let i = 0; i < sorted.length - 1; i++) {
                    const idxA = getIdx(sorted[i]);
                    const idxB = getIdx(sorted[i + 1]);
                    const diff = idxB - idxA;

                    if (diff < 1) return { valid: false, points: 0 };
                    if (diff > 2) return { valid: false, points: 0 };

                    const missingCount = diff - 1;
                    gaps += missingCount;

                    for (let k = 1; k <= missingCount; k++) {
                        const missingRankIdx = idxA + k;
                        let rankVal = 0;
                        if (missingRankIdx === -1) rankVal = 1;
                        else {
                            const r = RANKS[missingRankIdx];
                            rankVal = getRankValue(r, treatAceLow);
                        }
                        points += rankVal;
                    }
                }

                if (gaps > jokerCount) return { valid: false, points: 0 };

                const remainingJokers = jokerCount - gaps;
                if (remainingJokers > 2) return { valid: false, points: 0 }; 

                let rightIdx = getIdx(sorted[sorted.length - 1]);
                let leftIdx = getIdx(sorted[0]);

                let addedRight = 0;
                let addedLeft = 0;
                let pending = remainingJokers;

                while (pending > 0) {
                    let placed = false;
                    // Try Right
                    if (addedRight === 0 && rightIdx < RANKS.length - 1) {
                        rightIdx++; 
                        addedRight++;
                        const r = RANKS[rightIdx];
                        points += getRankValue(r, treatAceLow);
                        placed = true;
                        pending--;
                    }
                    // Try Left
                    else if (addedLeft === 0 && pending > 0 && leftIdx > (treatAceLow ? -1 : 0)) {
                        leftIdx--;
                        addedLeft++;
                        if (leftIdx === -1) points += 1;
                        else points += getRankValue(RANKS[leftIdx], treatAceLow);
                        placed = true;
                        pending--;
                    }

                    if (!placed && pending > 0) {
                        return { valid: false, points: 0 };
                    }
                }

                return { valid: true, points, type: 'run', isPure: jokerCount === 0 };
            };

            const highRes = trySequence(false);
            if (highRes.valid) return highRes;

            if (nonJokers.some(c => c.rank === 'A')) {
                const lowRes = trySequence(true);
                if (lowRes.valid) return lowRes;
            }
        }
    }
    return { valid: false, points: 0 };
}
