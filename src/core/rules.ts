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
    // 1. Reset Joker representations for any Joker that conflicts with a real card in the set/run
    const nonJokers = cards.filter(c => !c.isJoker);
    const jokers = cards.filter(c => c.isJoker);

    // Safety: If a Joker claims to be a card that is now physically present (real), 
    // we MUST clear that Joker's representation to force recalculation.
    jokers.forEach(j => {
        if (j.representation) {
            const conflict = nonJokers.some(real => 
                real.suit === j.representation!.suit && 
                real.rank === j.representation!.rank
            );
            if (conflict) {
                j.representation = undefined;
            }
        }
    });

    const validRes = validateMeld(cards);
    if (!validRes.valid || !validRes.type) return cards;

    // Split again after potential cleans
    const jokersWithRep = jokers.filter(j => j.representation !== undefined);
    const jokersWithoutRep = jokers.filter(j => j.representation === undefined);

    if (validRes.type === 'set') {
        const rank = nonJokers[0].rank;
        const usedSuits = new Set(nonJokers.map(c => c.suit));

        jokersWithRep.forEach(j => {
            if (j.representation) usedSuits.add(j.representation.suit);
        });

        const allSuits: Suit[] = ['♥', '♦', '♣', '♠'];

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
        
        // Determine Ace Low/High context based on other cards
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

        // Calculate gaps to verify if existing Joker reps are still valid
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

        // If we have more gaps than free jokers + existing rep jokers, 
        // something is wrong or shifted. Reset all to be safe.
        // Actually, safer to reset if ANY gaps exist, to ensure optimal placement (filling gaps first).
        if (gapsToFill > 0) {
            // Force recalculation of ALL jokers if there are internal gaps to fill.
            // This prevents a Joker at the end from staying at the end when it should fill a new gap.
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
        const currentEnd = allCardsInSequence.length > 0 ? allCardsInSequence[allCardsInSequence.length - 1].idx : 0;

        while (availableJokers.length > 0) {
            const j = availableJokers.shift()!;
            // Calculate where the sequence currently ends in terms of Rank Index
            // We need to look at finalSeq to see what the last rank actually is now
            // But finalSeq contains mix of cards. 
            // Easier approach: Track end index.
            
            // Logic: Try appending to High End first
            // Calculate hypothetical next index
            // We need to know the rank index of the last element in finalSeq
            const lastCard = finalSeq[finalSeq.length - 1];
            let lastIdx = -99;
            if (lastCard.isJoker && lastCard.representation) {
                lastIdx = getRankIdx({ rank: lastCard.representation.rank, getOrder: () => 0 } as ICard);
            } else if (!lastCard.isJoker) {
                lastIdx = getRankIdx(lastCard);
            } else {
                // Should not happen if logic flows, but fallback
                lastIdx = currentEnd;
            }

            if (lastIdx + 1 < RANKS.length) {
                j.representation = { rank: getRankFromIdx(lastIdx + 1), suit: suit };
                finalSeq.push(j);
            } else {
                // Try Prepending to Low End
                const firstCard = finalSeq[0];
                let firstIdx = 99;
                if (firstCard.isJoker && firstCard.representation) {
                     firstIdx = getRankIdx({ rank: firstCard.representation.rank, getOrder: () => 0 } as ICard);
                } else if (!firstCard.isJoker) {
                     firstIdx = getRankIdx(firstCard);
                }

                if (firstIdx - 1 >= -1) { // -1 is Ace Low
                    j.representation = { rank: getRankFromIdx(firstIdx - 1), suit: suit };
                    finalSeq.unshift(j);
                } else {
                    // Cannot fit at either end (e.g. A-2...K-A sequence full?)
                    // Just push it effectively invalidating visual but keeping card
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

                    if (diff < 1) return { valid: false, points: 0 }; // Duplicate rank in run (impossible with same suit unless multiple decks, but caught here)
                    if (diff > 2) return { valid: false, points: 0 }; // Gap too large for single Joker? Note: Rules say jokers cannot be adjacent. So max gap size is 1 missing card. Diff 2 means 1 missing. Diff 3 means 2 missing (requires 2 jokers adjacent).

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

                // Rule: "Two Jokers cannot be adjacent".
                // We've already ensured gaps of size > 1 are invalid (diff > 2).
                // So gaps are always size 1. This means Jokers filling gaps are isolated.
                // However, we must check remaining Jokers placed at Ends.
                
                const remainingJokers = jokerCount - gaps;
                
                // If we have remaining jokers > 1, and they are placed at ONE end, they would be adjacent.
                // We must be able to distribute them: one left, one right?
                // Or if we have 3 remaining jokers? Impossible to avoid adjacency if only 2 ends.
                if (remainingJokers > 2) return { valid: false, points: 0 }; 

                // But wait, what if we place 1 left, 1 right? That is valid.
                // What if we have 2 remaining, but one end is blocked (e.g. Ace Low start)?
                
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
                        // Cannot place remaining joker without adjacency or bounds error
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
