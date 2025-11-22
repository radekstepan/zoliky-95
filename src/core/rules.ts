import { ICard, MeldResult } from "../types";

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
 * Calculates value of a meld based on specific Jolly rules:
 * - Ace is 1 if A-2-3 sequence.
 * - Ace is 10 otherwise (Q-K-A or Sets).
 */
function calculateMeldPoints(cards: ICard[], type: 'set' | 'run'): number {
    let points = 0;
    
    if (type === 'set') {
        // In sets (e.g. A,A,A), Ace is always high (10)
        const representative = cards.find(c => !c.isJoker);
        if (!representative) return 0; 
        
        const val = representative.getValue(); // Returns 10 for A, J, Q, K
        return val * cards.length;
    }

    if (type === 'run') {
        const nonJokers = cards.filter(c => !c.isJoker);
        const hasAce = nonJokers.some(c => c.rank === 'A');
        
        let isAceLow = false;
        if (hasAce) {
            // If '2', '3', '4', '5' are present, it's likely a low run
            const lowRanks = ['2', '3', '4', '5'];
            if (nonJokers.some(c => lowRanks.includes(c.rank))) {
                isAceLow = true;
            }
        }

        points = cards.reduce((acc, c) => {
            if (c.isJoker) return acc; // Add Joker value later
            return acc + c.getValue();
        }, 0);

        const jokerCount = cards.filter(c => c.isJoker).length;
        points += (jokerCount * 10); 

        if (isAceLow) {
            // Subtract 9 for every Ace (real)
            const aceCount = cards.filter(c => c.rank === 'A').length;
            points -= (aceCount * 9);
            
            // Treat Jokers as ~1 point in low runs roughly.
            points -= (jokerCount * 9); 
        }
    }

    return Math.max(0, points);
}

export function validateMeld(cards: ICard[]): MeldResult {
    const jokerCount = cards.filter(c => c.isJoker).length;
    const nonJokers = cards.filter(c => !c.isJoker);
    
    if (cards.length < 3) return { valid: false, points: 0 }; 
    
    // Check: 2 Jokers cannot be next to each other.
    for(let i=0; i<cards.length -1; i++) {
        if(cards[i].isJoker && cards[i+1].isJoker) {
             return { valid: false, points: 0 }; 
        }
    }

    // 1. Check for Set
    if (nonJokers.length > 0) {
        const firstRank = nonJokers[0].rank;
        const isSet = nonJokers.every(c => c.rank === firstRank);
        
        if (isSet) {
             const pts = calculateMeldPoints(cards, 'set');
             return { valid: true, points: pts, type: 'set', isPure: jokerCount === 0 };
        }
    }

    // 2. Check for Run
    if (nonJokers.length > 0) {
        const firstSuit = nonJokers[0].suit;
        const isSameSuit = nonJokers.every(c => c.suit === firstSuit);
        
        if (isSameSuit) {
            // Helper to check sequence with specific sorting
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
                    if (diff < 1) return false; // Duplicates or wrong order
                    gaps += (diff - 1);
                }
                
                return gaps <= jokerCount;
            };

            // Try Ace High (Standard)
            if (checkSequence(false)) {
                const pts = calculateMeldPoints(cards, 'run');
                return { valid: true, points: pts, type: 'run', isPure: jokerCount === 0 };
            }
            
            // Try Ace Low (if Ace exists)
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
