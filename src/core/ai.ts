import { ICard, Difficulty } from "../types";
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
    tableMelds: ICard[][] = [], 
    difficulty: Difficulty = 'hard'
): AiMove {
    const state = new AiSolver(hand, hasOpened, tableMelds, difficulty);
    return state.solve();
}

class AiSolver {
    private hand: ICard[];
    private hasOpened: boolean;
    private tableMelds: ICard[][];
    private difficulty: Difficulty;

    constructor(hand: ICard[], hasOpened: boolean, tableMelds: ICard[][], difficulty: Difficulty) {
        this.hand = [...hand]; 
        this.hasOpened = hasOpened;
        this.tableMelds = tableMelds || [];
        this.difficulty = difficulty;
    }

    public solve(): AiMove {
        // 1. Look for Joker Swaps on the table
        let swaps = this.findJokerSwaps();

        // DIFFICULTY: Easy AI misses swaps. Medium misses 50% of the time.
        if (this.difficulty === 'easy') {
            swaps = [];
        } else if (this.difficulty === 'medium') {
            if (Math.random() > 0.5) swaps = [];
        }
        
        let workingHand = [...this.hand];
        
        // 2. Find Best Meld Configuration
        const allPotentialMelds = this.findAllPossibleMelds(workingHand);
        
        // Find the non-overlapping subset of melds that maximizes score
        const bestMelds = this.optimizeMelds(allPotentialMelds);

        // 3. Check Opening Rules and Difficulty Limits
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
            // DIFFICULTY: Easy AI only plays one meld at a time
            if (this.difficulty === 'easy' && bestMelds.length > 1) {
                finalMeldsToPlay = [bestMelds[0]];
            } else {
                finalMeldsToPlay = bestMelds;
            }
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
            
            // Set of 3
            if (group.length >= 3) {
                const combos3 = this.getCombinations(group, 3);
                possible.push(...combos3);
            }
            
            // Set of 4
            if (group.length >= 4) {
                 const combos4 = this.getCombinations(group, 4);
                 possible.push(...combos4);
            }

            // Sets with Jokers
            if (jokers.length >= 1) {
                // Pair + Joker
                if (group.length >= 2) {
                    const combos2 = this.getCombinations(group, 2);
                    combos2.forEach(c => possible.push([...c, jokers[0]]));
                }
                
                // Triple + Joker
                if (group.length >= 3) {
                    const combos3 = this.getCombinations(group, 3);
                    combos3.forEach(c => possible.push([...c, jokers[0]]));
                }
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
                     // Run with gap filled by Joker (e.g. 4, 6 -> 4, JK, 6)
                     if (diff === 2) {
                         const run = [cards[i], jokers[0], cards[i+1]];
                         if (validateMeld(run).valid) possible.push(run);
                     }
                     // Run with Joker at end (e.g. 4, 5 -> 4, 5, JK)
                     if (diff === 1) {
                         const run = [cards[i], cards[i+1], jokers[0]];
                         if (validateMeld(run).valid) possible.push(run);
                     }
                 }
            }
        }

        return possible;
    }

    private getCombinations(cards: ICard[], size: number): ICard[][] {
        if (size === 0) return [[]];
        if (cards.length === 0) return [];
        
        const [head, ...tail] = cards;
        
        const withHead = this.getCombinations(tail, size - 1).map(c => [head, ...c]);
        const withoutHead = this.getCombinations(tail, size);
        
        return [...withHead, ...withoutHead];
    }

    private optimizeMelds(allMelds: ICard[][]): ICard[][] {
        const scoredMelds = allMelds.map(m => {
            const res = validateMeld(m);
            return { 
                meld: m, 
                points: res.points, 
                isPure: res.isPure, 
                valid: res.valid,
                type: res.type 
            };
        });

        // Filter out invalid melds
        const validMelds = scoredMelds.filter(m => m.valid && m.points > 0);

        validMelds.sort((a, b) => {
            if (!this.hasOpened) {
                const aPureRun = a.isPure && a.type === 'run';
                const bPureRun = b.isPure && b.type === 'run';
                
                // Strict priority for Pure Runs to satisfy opening condition
                if (aPureRun && !bPureRun) return -1;
                if (!aPureRun && bPureRun) return 1;
            }
            
            // Standard fallback: prefer points
            return b.points - a.points;
        });

        const chosen: ICard[][] = [];
        const usedIds = new Set<number>();

        for (const item of validMelds) {
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

        // --- DIFFICULTY BASED DISCARD ---

        // EASY: Random Discard
        if (this.difficulty === 'easy') {
            const randomIndex = Math.floor(Math.random() * nonJokers.length);
            return nonJokers[randomIndex];
        }

        // MEDIUM: Greedy (Points Only)
        // Discard highest value card to minimize penalty points
        if (this.difficulty === 'medium') {
            const sortedByValue = [...nonJokers].sort((a, b) => b.getValue() - a.getValue());
            return sortedByValue[0];
        }

        // HARD: Synergy Based (Original Logic)
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
