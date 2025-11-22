import { ICard } from "../types";
import { validateMeld } from "./rules";

export interface AiMove {
    meldsToPlay: ICard[][];
    discardCard: ICard | null;
}

export function calculateCpuMove(hand: ICard[], hasOpened: boolean): AiMove {
    const meldsToPlay: ICard[][] = [];
    let tempHand = [...hand];

    // 1. Grouping
    const rankGroups: Record<string, ICard[]> = {};
    const suitGroups: Record<string, ICard[]> = {};
    
    tempHand.forEach(c => {
        if (c.isJoker) return;
        if (!rankGroups[c.rank]) rankGroups[c.rank] = [];
        rankGroups[c.rank].push(c);
        
        if (!suitGroups[c.suit]) suitGroups[c.suit] = [];
        suitGroups[c.suit].push(c);
    });

    // 2. Scan for Pure Runs (High Priority for Opening)
    for (let s in suitGroups) {
        const cards = suitGroups[s].sort((a, b) => a.getOrder() - b.getOrder());
        if (cards.length >= 3) {
            // Simple slider: check i, i+1, i+2
            for (let i = 0; i <= cards.length - 3; i++) {
                const sub = cards.slice(i, i + 3);
                // Only take if pure (no jokers in suitGroups anyway) and valid
                const val = validateMeld(sub);
                if (val.valid && val.type === 'run') {
                     meldsToPlay.push(sub);
                     tempHand = tempHand.filter(c => !sub.includes(c));
                     // Remove from groups to avoid double usage?
                     // Re-filtering rankGroups is expensive, just check tempHand inclusion later
                     i += 2; // Skip used
                }
            }
        }
    }

    // 3. Scan for Sets
    for (let r in rankGroups) {
        // filtering out cards already used in Runs
        const available = rankGroups[r].filter(c => tempHand.some(tc => tc.id === c.id));
        
        if (available.length >= 3) {
            const meldCards = available.slice(0, 4);
            const val = validateMeld(meldCards);
            if (val.valid) {
                meldsToPlay.push(meldCards);
                tempHand = tempHand.filter(c => !meldCards.includes(c));
            }
        }
    }

    // Validation for Opening Rules
    if (!hasOpened) {
        let points = 0;
        let hasPureRun = false;
        meldsToPlay.forEach(m => {
            const res = validateMeld(m);
            points += res.points;
            if (res.type === 'run' && res.isPure) hasPureRun = true;
        });

        if (points < 36 || !hasPureRun) {
            return { meldsToPlay: [], discardCard: tempHand[0] || null };
        }
    }

    // Discard
    let discardCard: ICard | null = null;
    if (tempHand.length > 0) {
        tempHand.sort((a, b) => b.getValue() - a.getValue());
        discardCard = tempHand[0];
    }

    return { meldsToPlay, discardCard };
}
