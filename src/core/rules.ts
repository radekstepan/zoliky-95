import { ICard, MeldResult, Rank, Suit } from "../types";
import { RANKS } from "./Card";

/**
 * Sorts a hand: Suit then Rank.
 */
export function sortHandLogic(hand: ICard[]): void {
    hand.sort((a, b) => {
        if (a.suit === b.suit) return a.getOrder() - b.getOrder();
        return a.suit.localeCompare(b.suit);
    });
}

/**
 * Organizes a meld for display and logic:
 * 1. Determines if Set or Run.
 * 2. Sorts cards.
 * 3. Assigns 'representation' to Jokers.
 */
export function organizeMeld(cards: ICard[]): ICard[] {
    const validRes = validateMeld(cards);
    if (!validRes.valid || !validRes.type) return cards;

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
        combined.sort((a,b) => {
            const sA = a.representation?.suit || a.suit;
            const sB = b.representation?.suit || b.suit;
            return sA.localeCompare(sB);
        });
        return combined;
    } 

    // --- RUN Logic ---
    if (validRes.type === 'run') {
        // Check for Ace Low
        const hasAce = nonJokers.some(c => c.rank === 'A');
        let isAceLow = false;
        if (hasAce) {
             const lowRanks = ['2', '3', '4', '5'];
             if (nonJokers.some(c => lowRanks.includes(c.rank))) isAceLow = true;
        }

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

        const getRankIdx = (c: ICard) => {
            if (isAceLow && c.rank === 'A') return -1;
            return RANKS.indexOf(c.rank);
        };

        const getRankFromIdx = (idx: number): Rank => {
            if (idx === -1) return 'A';
            return RANKS[idx];
        };

        // Fill gaps between non-jokers
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

        // Use remaining jokers to extend
        while(jokers.length > 0) {
            const j = jokers.shift()!;
            const nextIdx = currentRankIdx + 1;
            
            // Prefer extending upwards unless at max
            if (nextIdx < RANKS.length) { 
                 j.representation = { rank: getRankFromIdx(nextIdx), suit: suit };
                 finalSeq.push(j);
                 currentRankIdx++;
            } else {
                // Extend downwards
                const firstCard = finalSeq[0];
                const firstRank = firstCard.representation ? firstCard.representation.rank : firstCard.rank;
                let firstIdx = RANKS.indexOf(firstRank);
                if (firstRank === 'A' && isAceLow) firstIdx = -1;

                const prevIdx = firstIdx - 1;
                if (prevIdx >= -1) { 
                     j.representation = { rank: getRankFromIdx(prevIdx), suit: suit };
                     finalSeq.unshift(j);
                } else {
                    // Nowhere to go (e.g. run full A-A?), just push
                    finalSeq.push(j);
                }
            }
        }
        return finalSeq;
    }

    return cards;
}

function calculateMeldPoints(cards: ICard[], type: 'set' | 'run'): number {
    let points = 0;
    
    if (type === 'set') {
        const representative = cards.find(c => !c.isJoker);
        if (!representative) return 0; 
        const val = representative.getValue(); 
        return val * cards.length;
    }

    if (type === 'run') {
        const nonJokers = cards.filter(c => !c.isJoker);
        const hasAce = nonJokers.some(c => c.rank === 'A');
        
        let isAceLow = false;
        if (hasAce) {
            const lowRanks = ['2', '3', '4', '5'];
            if (nonJokers.some(c => lowRanks.includes(c.rank))) isAceLow = true;
        }

        points = cards.reduce((acc, c) => {
            if (c.isJoker) return acc; 
            return acc + c.getValue();
        }, 0);

        const jokerCount = cards.filter(c => c.isJoker).length;
        points += (jokerCount * 10); 

        if (isAceLow) {
            const aceCount = cards.filter(c => c.rank === 'A').length;
            points -= (aceCount * 9);
            points -= (jokerCount * 9); 
        }
    }
    return Math.max(0, points);
}

export function validateMeld(cards: ICard[]): MeldResult {
    const jokerCount = cards.filter(c => c.isJoker).length;
    const nonJokers = cards.filter(c => !c.isJoker);
    
    if (cards.length < 3) return { valid: false, points: 0 }; 
    
    // Check: 2 Jokers cannot be next to each other in the provided array.
    for(let i=0; i<cards.length -1; i++) {
        if(cards[i].isJoker && cards[i+1].isJoker) {
             return { valid: false, points: 0 }; 
        }
    }

    // 1. Set Check
    if (nonJokers.length > 0) {
        const firstRank = nonJokers[0].rank;
        const isSet = nonJokers.every(c => c.rank === firstRank);
        if (isSet) {
             const suits = nonJokers.map(c => c.suit);
             const uniqueSuits = new Set(suits);
             if (uniqueSuits.size !== suits.length) return { valid: false, points: 0 };

             const pts = calculateMeldPoints(cards, 'set');
             return { valid: true, points: pts, type: 'set', isPure: jokerCount === 0 };
        }
    }

    // 2. Run Check
    if (nonJokers.length > 0) {
        const firstSuit = nonJokers[0].suit;
        const isSameSuit = nonJokers.every(c => c.suit === firstSuit);
        if (isSameSuit) {
            const checkSequence = (treatAceLow: boolean): boolean => {
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
                for (let i = 0; i < sorted.length - 1; i++) {
                    let oa = sorted[i].getOrder();
                    let ob = sorted[i+1].getOrder();
                    if (treatAceLow) {
                        if (sorted[i].rank === 'A') oa = -1;
                        if (sorted[i+1].rank === 'A') ob = -1;
                    }
                    
                    const diff = ob - oa;
                    if (diff < 1) return false; 
                    gaps += (diff - 1);
                }
                return gaps <= jokerCount;
            };

            // Try Ace High first
            if (checkSequence(false)) {
                const pts = calculateMeldPoints(cards, 'run');
                return { valid: true, points: pts, type: 'run', isPure: jokerCount === 0 };
            }
            // Try Ace Low
            if (nonJokers.some(c => c.rank === 'A')) {
                if (checkSequence(true)) {
                    const pts = calculateMeldPoints(cards, 'run');
                    return { valid: true, points: pts, type: 'run', isPure: jokerCount === 0 };
                }
            }
        }
    }
    return { valid: false, points: 0 };
}
