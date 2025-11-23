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

// Helper to get value from rank string
function getRankValue(rank: Rank, isAceLow: boolean): number {
    if (rank === 'A') return isAceLow ? 1 : 10;
    if (['J', 'Q', 'K'].includes(rank)) return 10;
    return parseInt(rank, 10) || 0;
}

/**
 * Organizes a meld and ASSIGNS representations to Jokers.
 * This logic is critical for both display and accurate scoring.
 */
export function organizeMeld(cards: ICard[]): ICard[] {
    const validRes = validateMeld(cards);
    if (!validRes.valid || !validRes.type) return cards;

    // Reset representations
    cards.forEach(c => c.representation = undefined);

    const jokers = cards.filter(c => c.isJoker);
    const nonJokers = cards.filter(c => !c.isJoker);

    // --- SET Logic ---
    if (validRes.type === 'set') {
        const rank = nonJokers[0].rank;
        const usedSuits = new Set(nonJokers.map(c => c.suit));
        const allSuits: Suit[] = ['♥', '♦', '♣', '♠'];
        
        let jokerIdx = 0;
        for(const s of allSuits) {
            if (!usedSuits.has(s) && jokerIdx < jokers.length) {
                jokers[jokerIdx].representation = { rank: rank, suit: s };
                jokerIdx++;
            }
        }
        
        const combined = [...nonJokers, ...jokers];
        // Sort sets by suit order
        combined.sort((a,b) => {
            const sA = a.representation?.suit || a.suit;
            const sB = b.representation?.suit || b.suit;
            return SUITS.indexOf(sA) - SUITS.indexOf(sB);
        });
        return combined;
    } 

    // --- RUN Logic ---
    if (validRes.type === 'run') {
        const hasAce = nonJokers.some(c => c.rank === 'A');
        // Check for Ace Low context: A, 2, 3...
        let isAceLow = false;
        if (hasAce) {
             const lowRanks = ['2', '3', '4', '5'];
             if (nonJokers.some(c => lowRanks.includes(c.rank))) isAceLow = true;
        }

        // Sort non-jokers
        nonJokers.sort((a,b) => {
            let oa = a.getOrder(); 
            let ob = b.getOrder();
            if(isAceLow) {
                if(a.rank === 'A') oa = -1;
                if(b.rank === 'A') ob = -1;
            }
            return oa - ob;
        });

        const suit = nonJokers[0].suit;
        const finalSeq: ICard[] = [];
        let currentRankIdx = -999; 

        // Index Mapping Helpers
        const getRankIdx = (c: ICard) => {
            if (isAceLow && c.rank === 'A') return -1;
            return RANKS.indexOf(c.rank);
        };
        const getRankFromIdx = (idx: number): Rank => {
            if (idx === -1) return 'A';
            return RANKS[idx];
        };

        // Fill Gaps
        for(let i=0; i<nonJokers.length; i++) {
            const card = nonJokers[i];
            const idx = getRankIdx(card);
            
            if (i === 0) {
                finalSeq.push(card);
                currentRankIdx = idx;
            } else {
                const diff = idx - currentRankIdx;
                if (diff > 1) {
                    const needed = diff - 1;
                    for(let k=0; k<needed; k++) {
                        if (jokers.length > 0) {
                            const j = jokers.shift()!;
                            const repRankIdx = currentRankIdx + 1 + k;
                            j.representation = { rank: getRankFromIdx(repRankIdx), suit: suit };
                            finalSeq.push(j);
                        }
                    }
                }
                finalSeq.push(card);
                currentRankIdx = idx;
            }
        }

        // Extend Ends (Top first, then Bottom)
        while(jokers.length > 0) {
            const j = jokers.shift()!;
            const nextIdx = currentRankIdx + 1;
            
            if (nextIdx < RANKS.length) { 
                 j.representation = { rank: getRankFromIdx(nextIdx), suit: suit };
                 finalSeq.push(j);
                 currentRankIdx++;
            } else {
                // Try prepend
                const firstCard = finalSeq[0];
                const firstRank = firstCard.representation ? firstCard.representation.rank : firstCard.rank;
                let firstIdx = RANKS.indexOf(firstRank);
                if (firstRank === 'A' && isAceLow) firstIdx = -1;

                const prevIdx = firstIdx - 1;
                if (prevIdx >= -1) { 
                     j.representation = { rank: getRankFromIdx(prevIdx), suit: suit };
                     finalSeq.unshift(j);
                } else {
                    // Cannot fit anywhere valid (e.g. K, A, 2 not allowed)
                    // Just push to end to avoid loss, though technically invalid if unused
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
             // Sets need different suits
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
            // Helper to dry run valid sequence and calc points
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

                // Calculate non-joker points
                points += nonJokers.reduce((acc, c) => acc + getRankValue(c.rank, treatAceLow), 0);

                // Determine Gaps to fill with Jokers
                const getIdx = (c: ICard) => {
                    if (treatAceLow && c.rank === 'A') return -1;
                    return RANKS.indexOf(c.rank);
                };

                for (let i = 0; i < sorted.length - 1; i++) {
                    const idxA = getIdx(sorted[i]);
                    const idxB = getIdx(sorted[i+1]);
                    const diff = idxB - idxA;
                    
                    if (diff < 1) return { valid: false, points: 0 }; // Duplicate rank in run?
                    
                    const missingCount = diff - 1;
                    gaps += missingCount;

                    // Add points for Jokers filling these specific gaps
                    for(let k=1; k<=missingCount; k++) {
                        const missingRankIdx = idxA + k;
                        let rankVal = 0;
                        if (missingRankIdx === -1) rankVal = 1; // Low Ace
                        else {
                            const r = RANKS[missingRankIdx];
                            rankVal = getRankValue(r, treatAceLow);
                        }
                        points += rankVal;
                    }
                }

                if (gaps > jokerCount) return { valid: false, points: 0 };

                // Remaining Jokers go to ends. 
                // Algorithm: Prefer High End, then Low End.
                let remainingJokers = jokerCount - gaps;
                let rightIdx = getIdx(sorted[sorted.length-1]);
                let leftIdx = getIdx(sorted[0]);

                while(remainingJokers > 0) {
                    // Try right
                    if (rightIdx < RANKS.length - 1) {
                        rightIdx++;
                        const r = RANKS[rightIdx];
                        points += getRankValue(r, treatAceLow);
                        remainingJokers--;
                    } else if (leftIdx > (treatAceLow ? -1 : 0)) {
                        leftIdx--;
                        if (leftIdx === -1) points += 1;
                        else points += getRankValue(RANKS[leftIdx], treatAceLow);
                        remainingJokers--;
                    } else {
                        // Cannot fit joker
                        return { valid: false, points: 0 };
                    }
                }

                return { valid: true, points, type: 'run', isPure: jokerCount === 0 };
            };

            // Try High Ace first (prefer 10pts)
            const highRes = trySequence(false);
            if (highRes.valid) return highRes;

            // If has Ace, try Low Ace
            if (nonJokers.some(c => c.rank === 'A')) {
                const lowRes = trySequence(true);
                if (lowRes.valid) return lowRes;
            }
        }
    }
    return { valid: false, points: 0 };
}
