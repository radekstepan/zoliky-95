import { ICard, MeldResult } from "../types";

/**
 * Sorts a hand of cards in place.
 * Group by Suit, then by Rank order.
 */
export function sortHandLogic(hand: ICard[]): void {
    hand.sort((a, b) => {
        if (a.suit === b.suit) return a.getOrder() - b.getOrder();
        return a.suit.localeCompare(b.suit);
    });
}

/**
 * Validates a set of cards to see if they form a valid Meld (Set or Run).
 */
export function validateMeld(cards: ICard[]): MeldResult {
    const jokerCount = cards.filter(c => c.isJoker).length;
    const nonJokers = cards.filter(c => !c.isJoker);
    
    if (nonJokers.length === 0) return { valid: false, points: 0 }; 
    
    // 1. Check for Set (Same Rank)
    const firstRank = nonJokers[0].rank;
    const isSet = nonJokers.every(c => c.rank === firstRank);
    
    if (isSet && cards.length >= 3) {
        let val = nonJokers[0].getValue();
        return { valid: true, points: val * cards.length, type: 'set' };
    }

    // 2. Check for Run (Sequence in Same Suit)
    const firstSuit = nonJokers[0].suit;
    const isSameSuit = nonJokers.every(c => c.suit === firstSuit);
    
    if (isSameSuit && cards.length >= 3) {
        // Sort only for validation check
        const sorted = [...nonJokers].sort((a, b) => a.getOrder() - b.getOrder());
        
        let gaps = 0;
        for (let i = 0; i < sorted.length - 1; i++) {
            const diff = sorted[i+1].getOrder() - sorted[i].getOrder();
            // Duplicate ranks in a run are invalid (e.g. 4, 4, 5)
            if (diff < 1) return { valid: false, points: 0 }; 
            // Diff of 1 means sequential (4,5). Diff of 2 (4,6) means 1 gap.
            gaps += (diff - 1);
        }
        
        // Jokers fill the gaps
        if (gaps <= jokerCount) {
            let sum = nonJokers.reduce((acc, c) => acc + c.getValue(), 0);
            // Jokers in runs usually count as the card they represent.
            // For simplicity in this version, Jokers add 10 points or 
            // inherit average value. The original JS used fixed logic:
            sum += (jokerCount * 10); 
            
            return { valid: true, points: sum, type: 'run' };
        }
    }

    return { valid: false, points: 0 };
}
