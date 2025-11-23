import { ICard } from "../types";
import { validateMeld } from "./rules";
import { SUITS, JOKER_SUIT } from "./Card";

export interface AiMove {
    meldsToPlay: ICard[][];
    discardCard: ICard | null;
    jokerSwaps: { meldIndex: number, handCardId: number }[];
}

/**
 * Main AI Entry Point
 */
export function calculateCpuMove(
    hand: ICard[], 
    hasOpened: boolean, 
    tableMelds: ICard[][] = [] // Default to empty array for robustness
): AiMove {
    const state = new AiSolver(hand, hasOpened, tableMelds);
    return state.solve();
}

class AiSolver {
    private hand: ICard[];
    private hasOpened: boolean;
    private tableMelds: ICard[][];

    constructor(hand: ICard[], hasOpened: boolean, tableMelds: ICard[][]) {
        this.hand = [...hand]; 
        this.hasOpened = hasOpened;
        this.tableMelds = tableMelds || [];
    }

    public solve(): AiMove {
        // 1. Look for Joker Swaps on the table
        const swaps = this.findJokerSwaps();
        
        let workingHand = [...this.hand];
        
        // 2. Find Best Meld Configuration
        const allPotentialMelds = this.findAllPossibleMelds(workingHand);
        
        // Find the non-overlapping subset of melds that maximizes score
        const bestMelds = this.optimizeMelds(allPotentialMelds);

        // 3. Check Opening Rules
        let finalMeldsToPlay: ICard[][] = [];
        
        if (!this.hasOpened) {
            const score = bestMelds.reduce((sum, m) => sum + validateMeld(m).points, 0);
            const hasPure = bestMelds.some(m => {
                const res = validateMeld(m);
                return res.type === 'run' && res.isPure;
            });

            if (score >= 36 && hasPure) {
                finalMeldsToPlay = bestMelds;
            }
        } else {
            finalMeldsToPlay = bestMelds;
        }

        // 4. Determine Discard
        const playedIds = new Set(finalMeldsToPlay.flat().map(c => c.id));
        let remainingCards = workingHand.filter(c => !playedIds.has(c.id));
        
        const discardCard = this.pickBestDiscard(remainingCards);

        return {
            meldsToPlay: finalMeldsToPlay,
            discardCard: discardCard,
            jokerSwaps: swaps
        };
    }

    // --- Joker Swapping Logic ---

    private findJokerSwaps(): { meldIndex: number, handCardId: number }[] {
        if (!this.hasOpened) return []; 

        const swaps: { meldIndex: number, handCardId: number }[] = [];
        
        this.tableMelds.forEach((meld, mIdx) => {
            const jokerIdx = meld.findIndex(c => c.isJoker);
            if (jokerIdx === -1) return;

            const nonJokers = meld.filter(c => !c.isJoker);
            if (nonJokers.length < 2) return; 

            // Check Set
            if (nonJokers[0].rank === nonJokers[1].rank) {
                // Rule: Set must become 4 suits to swap.
                if (nonJokers.length < 3) return; 
                
                const presentSuits = nonJokers.map(c => c.suit);
                const missingSuit = SUITS.find(s => s !== JOKER_SUIT && !presentSuits.includes(s));
                
                if (missingSuit) {
                    const candidate = this.hand.find(c => c.rank === nonJokers[0].rank && c.suit === missingSuit);
                    if (candidate) {
                        swaps.push({ meldIndex: mIdx, handCardId: candidate.id });
                    }
                }
            }
            // Check Run (Skipped for stability in basic AI)
        });

        return swaps;
    }

    // --- Meld Generation (Backtracking) ---

    private findAllPossibleMelds(hand: ICard[]): ICard[][] {
        const possible: ICard[][] = [];
        const jokers = hand.filter(c => c.isJoker);
        const normals = hand.filter(c => !c.isJoker);

        // 1. Find Sets
        const rankGroups: Record<string, ICard[]> = {};
        normals.forEach(c => {
            if (!rankGroups[c.rank]) rankGroups[c.rank] = [];
            rankGroups[c.rank].push(c);
        });

        for (const r in rankGroups) {
            const group = rankGroups[r];
            if (group.length >= 3) possible.push(group.slice(0, 3));
            if (group.length === 4) possible.push(group);

            if (group.length === 2 && jokers.length >= 1) {
                possible.push([...group, jokers[0]]);
            }
            if (group.length === 3 && jokers.length >= 1) {
                possible.push([...group, jokers[0]]);
            }
        }

        // 2. Find Runs
        const suitGroups: Record<string, ICard[]> = {};
        normals.forEach(c => {
            if (!suitGroups[c.suit]) suitGroups[c.suit] = [];
            suitGroups[c.suit].push(c);
        });

        for (const s in suitGroups) {
            const cards = suitGroups[s].sort((a, b) => a.getOrder() - b.getOrder());
            
            for (let len = 3; len <= 5; len++) {
                for (let i = 0; i <= cards.length - len; i++) {
                    const sub = cards.slice(i, i + len);
                    if (validateMeld(sub).valid) possible.push(sub);
                }
            }
            
            if (jokers.length > 0) {
                 for (let i = 0; i < cards.length - 1; i++) {
                     const diff = cards[i+1].getOrder() - cards[i].getOrder();
                     if (diff === 2) {
                         const run = [cards[i], jokers[0], cards[i+1]];
                         if (validateMeld(run).valid) possible.push(run);
                     }
                 }
            }
        }

        return possible;
    }

    private optimizeMelds(allMelds: ICard[][]): ICard[][] {
        const scoredMelds = allMelds.map(m => {
            const res = validateMeld(m);
            return { meld: m, points: res.points, isPure: res.isPure };
        });

        scoredMelds.sort((a, b) => {
            if (!this.hasOpened && a.isPure && !b.isPure) return -1;
            if (!this.hasOpened && !a.isPure && b.isPure) return 1;
            return b.points - a.points;
        });

        const chosen: ICard[][] = [];
        const usedIds = new Set<number>();

        for (const item of scoredMelds) {
            const isOverlap = item.meld.some(c => usedIds.has(c.id));
            if (!isOverlap) {
                chosen.push(item.meld);
                item.meld.forEach(c => usedIds.add(c.id));
            }
        }

        return chosen;
    }

    // --- Discard Logic ---

    private pickBestDiscard(hand: ICard[]): ICard | null {
        if (hand.length === 0) return null;

        const nonJokers = hand.filter(c => !c.isJoker);
        if (nonJokers.length === 0) return hand[0];

        const scores = nonJokers.map(card => {
            let synergy = 0;
            
            const sameRank = nonJokers.filter(c => c.id !== card.id && c.rank === card.rank).length;
            synergy += sameRank * 5;

            const sameSuit = nonJokers.filter(c => c.id !== card.id && c.suit === card.suit);
            const neighbors = sameSuit.filter(c => Math.abs(c.getOrder() - card.getOrder()) <= 2).length;
            synergy += neighbors * 3;

            const score = synergy - (card.getValue() * 0.5);
            return { card, score };
        });

        scores.sort((a, b) => a.score - b.score);

        return scores[0].card;
    }
}
