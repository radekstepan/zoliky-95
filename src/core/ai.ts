import { ICard } from "../types";
import { validateMeld } from "./rules";

export interface AiMove {
    meldsToPlay: ICard[][];
    discardCard: ICard | null;
}

/**
 * Calculates the best move for the CPU.
 */
export function calculateCpuMove(hand: ICard[], hasOpened: boolean): AiMove {
    const meldsToPlay: ICard[][] = [];
    // Work on a copy so we don't mutate the actual hand during calculation
    let tempHand = [...hand];

    const rankGroups: Record<string, ICard[]> = {};
    
    // Group by Rank
    tempHand.forEach(c => {
        if(c.isJoker) return;
        if(!rankGroups[c.rank]) rankGroups[c.rank] = [];
        rankGroups[c.rank].push(c);
    });

    // Detect Sets
    for (let r in rankGroups) {
        if (rankGroups[r].length >= 3) {
            const meldCards = rankGroups[r].slice(0, 3);
            const val = validateMeld(meldCards);
            
            if (val.valid) {
                // Opening Rule Check
                if (!hasOpened) {
                    if (val.points >= 36) {
                        // Valid opening
                        meldsToPlay.push(meldCards);
                        tempHand = tempHand.filter(c => !meldCards.includes(c));
                    }
                } else {
                    // Already opened, just play it
                    meldsToPlay.push(meldCards);
                    tempHand = tempHand.filter(c => !meldCards.includes(c));
                }
            }
        }
    }

    // Discard Logic: Random for now (could be improved to discard high value or lonely cards)
    let discardCard: ICard | null = null;
    if (tempHand.length > 0) {
        const discardIndex = Math.floor(Math.random() * tempHand.length);
        discardCard = tempHand[discardIndex];
    }

    return {
        meldsToPlay,
        discardCard
    };
}
