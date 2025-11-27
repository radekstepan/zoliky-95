import { ICard, Difficulty } from "../types";
import { validateMeld, organizeMeld } from "./rules";
import { SUITS, JOKER_SUIT, Card } from "./Card";

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
    difficulty: Difficulty = 'hard',
    opponentHandSize: number = 12 // Default to safe assumption
): AiMove {
    const state = new AiSolver(hand, hasOpened, tableMelds, difficulty, opponentHandSize);
    return state.solve();
}

/**
 * Calculates the "Melding Distance" (number of cards left to meld).
 * Lower is better.
 */
export function evaluateHandProgress(
    hand: ICard[],
    hasOpened: boolean,
    tableMelds: ICard[][] = []
): number {
    const baseHand = cloneCards(hand);
    const baseTable = cloneMelds(tableMelds);

    const states = hasOpened
        ? generateSwapStates(baseHand, baseTable)
        : [{ hand: baseHand, table: baseTable }];

    let bestDistance = Number.POSITIVE_INFINITY;

    states.forEach(state => {
        const solver = new AiSolver(state.hand, hasOpened, state.table, 'hard', 12);
        const bestMelds = solver.getBestMelds();
        const distance = evaluateStateDistance(state.hand, state.table, bestMelds, hasOpened);
        if (distance < bestDistance) bestDistance = distance;
    });

    return bestDistance;
}

interface SwapState {
    hand: ICard[];
    table: ICard[][];
}

function evaluateStateDistance(hand: ICard[], table: ICard[][], bestMelds: ICard[][], hasOpened: boolean): number {
    const playedIds = new Set(bestMelds.flat().map(c => c.id));

    const remaining = hand.filter(c => !playedIds.has(c.id));

    const score = bestMelds.reduce((sum: number, m: ICard[]) => sum + validateMeld(m).points, 0);
    const hasPure = bestMelds.some((m: ICard[]) => {
        const res = validateMeld(m);
        return res.type === 'run' && res.isPure;
    });
    const canOpen = hasOpened || (score >= 36 && hasPure);

    let distance: number;

    if (canOpen) {
        const remainingCount = minimizeRemainingAfterTable(remaining, table);
        distance = remainingCount;
        if (distance <= 1) {
            distance = 0; // Can discard and win after laying off
        }
    } else {
        distance = remaining.length + 2; // Penalty for not being able to open
    }

    return distance;
}

function minimizeRemainingAfterTable(hand: ICard[], table: ICard[][]): number {
    if (hand.length === 0) return 0;
    if (table.length === 0) return hand.length;

    const memo = new Map<string, number>();

    const dfs = (currentHand: ICard[], currentTable: ICard[][]): number => {
        if (currentHand.length === 0) return 0;
        const key = serializeState(currentHand, currentTable);
        if (memo.has(key)) return memo.get(key)!;

        let best = currentHand.length;

        for (let hIdx = 0; hIdx < currentHand.length; hIdx++) {
            for (let mIdx = 0; mIdx < currentTable.length; mIdx++) {
                const added = attemptAddCardToMeld(currentHand[hIdx], currentTable[mIdx]);
                if (!added) continue;

                const nextHand = cloneCards([
                    ...currentHand.slice(0, hIdx),
                    ...currentHand.slice(hIdx + 1)
                ]);

                const nextTable = currentTable.map((meld, idx) =>
                    idx === mIdx ? cloneCards(added) : cloneCards(meld)
                );

                best = Math.min(best, dfs(nextHand, nextTable));
            }
        }

        memo.set(key, best);
        return best;
    };

    return dfs(cloneCards(hand), cloneMelds(table));
}

function attemptAddCardToMeld(card: ICard, meld: ICard[]): ICard[] | null {
    const candidate = [...meld.map(cloneCard), cloneCard(card)];
    const organized = organizeMeld(candidate);
    const res = validateMeld(organized);
    return res.valid ? organized.map(cloneCard) : null;
}

function generateSwapStates(hand: ICard[], table: ICard[][]): SwapState[] {
    const results: SwapState[] = [];
    const seen = new Set<string>();

    const dfs = (currentHand: ICard[], currentTable: ICard[][]) => {
        const key = serializeState(currentHand, currentTable);
        if (seen.has(key)) return;
        seen.add(key);

        results.push({ hand: cloneCards(currentHand), table: cloneMelds(currentTable) });

        const swapOptions = findSetSwapOptions(currentHand, currentTable);
        swapOptions.forEach(opt => {
            const nextHand = cloneCards(currentHand);
            const nextTable = cloneMelds(currentTable);

            const handIdx = nextHand.findIndex(c => c.id === opt.handCardId);
            if (handIdx === -1) return;

            const replacementCard = nextHand.splice(handIdx, 1)[0];
            const jokerCard = nextTable[opt.meldIndex][opt.jokerIndex];

            nextTable[opt.meldIndex][opt.jokerIndex] = cloneCard(replacementCard);
            nextHand.push(cloneCard(jokerCard));

            dfs(nextHand, nextTable);
        });
    };

    dfs(cloneCards(hand), cloneMelds(table));
    return results;
}

interface SwapOption {
    meldIndex: number;
    jokerIndex: number;
    handCardId: number;
}

function findSetSwapOptions(hand: ICard[], table: ICard[][]): SwapOption[] {
    const options: SwapOption[] = [];

    table.forEach((meld, meldIndex) => {
        const jokerIndex = meld.findIndex(c => c.isJoker);
        if (jokerIndex === -1) return;

        const nonJokers = meld.filter(c => !c.isJoker);
        if (nonJokers.length < 3) return; // Need 3 suits down already to allow swap

        const rank = nonJokers[0].rank;
        if (!nonJokers.every(c => c.rank === rank)) return;

        const presentSuits = new Set(nonJokers.map(c => c.suit));
        SUITS.forEach(suit => {
            if (suit === JOKER_SUIT) return;
            if (presentSuits.has(suit)) return;

            const candidate = hand.find(c => c.rank === rank && c.suit === suit);
            if (candidate) {
                options.push({ meldIndex, jokerIndex, handCardId: candidate.id });
            }
        });
    });

    return options;
}

function cloneCards(cards: ICard[]): ICard[] {
    return cards.map(cloneCard);
}

function cloneMelds(melds: ICard[][]): ICard[][] {
    return melds.map(m => cloneCards(m));
}

function cloneCard(card: ICard): ICard {
    const c = new Card(card.suit, card.rank, card.id);
    c.selected = card.selected;
    if (card.representation) {
        c.representation = { ...card.representation };
    }
    return c;
}

function serializeState(hand: ICard[], table: ICard[][]): string {
    const handKey = hand.map(c => c.id).sort((a, b) => a - b).join(',');
    const tableKey = table
        .map(m => m.map(c => c.id).sort((a, b) => a - b).join('-'))
        .join('|');
    return `${handKey}|${tableKey}`;
}

class AiSolver {
    private hand: ICard[];
    private hasOpened: boolean;
    private tableMelds: ICard[][];
    private difficulty: Difficulty;
    private opponentHandSize: number;

    constructor(
        hand: ICard[],
        hasOpened: boolean,
        tableMelds: ICard[][],
        difficulty: Difficulty,
        opponentHandSize: number
    ) {
        this.hand = [...hand];
        this.hasOpened = hasOpened;
        this.tableMelds = tableMelds || [];
        this.difficulty = difficulty;
        this.opponentHandSize = opponentHandSize;
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
        const bestMelds = this.getBestMelds();

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

    public getBestMelds(): ICard[][] {
        const allPotentialMelds = this.findAllPossibleMelds(this.hand);
        return this.optimizeMelds(allPotentialMelds);
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
                jokers.forEach(joker => {
                    // Pair + Joker
                    if (group.length >= 2) {
                        const combos2 = this.getCombinations(group, 2);
                        combos2.forEach(c => possible.push([...c, joker]));
                    }

                    // Triple + Joker
                    if (group.length >= 3) {
                        const combos3 = this.getCombinations(group, 3);
                        combos3.forEach(c => possible.push([...c, joker]));
                    }
                });
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
                jokers.forEach(joker => {
                    for (let i = 0; i < cards.length - 1; i++) {
                        const diff = cards[i + 1].getOrder() - cards[i].getOrder();
                        // Run with gap filled by Joker (e.g. 4, 6 -> 4, JK, 6)
                        if (diff === 2) {
                            const run = [cards[i], joker, cards[i + 1]];
                            if (validateMeld(run).valid) possible.push(run);
                        }
                        // Run with Joker at end (e.g. 4, 5 -> 4, 5, JK)
                        if (diff === 1) {
                            const run = [cards[i], cards[i + 1], joker];
                            if (validateMeld(run).valid) possible.push(run);
                        }
                        // Run with Joker at start (e.g. 4, 5 -> JK, 4, 5)
                        if (diff === 1) {
                            const run = [joker, cards[i], cards[i + 1]];
                            if (validateMeld(run).valid) possible.push(run);
                        }
                    }
                });
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
        // Pre-calculate metadata for performance
        const candidates = allMelds.map(m => {
            const res = validateMeld(m);
            return {
                meld: m,
                points: res.points,
                isPure: res.isPure && res.type === 'run',
                valid: res.valid && res.points > 0,
                mask: new Set(m.map(c => c.id))
            };
        }).filter(c => c.valid);

        // Sort candidates to try promising ones first (heuristic optimization)
        // 1. Pure Runs (if needed)
        // 2. Length (longer first)
        // 3. Points
        candidates.sort((a, b) => {
            if (!this.hasOpened) {
                if (a.isPure && !b.isPure) return -1;
                if (!a.isPure && b.isPure) return 1;
            }
            if (a.meld.length !== b.meld.length) return b.meld.length - a.meld.length;
            return b.points - a.points;
        });

        let bestSolution: ICard[][] = [];
        let bestStats = { cards: 0, points: 0, hasPure: false };

        const search = (index: number, currentMelds: ICard[][], usedIds: Set<number>, currentStats: { cards: number, points: number, hasPure: boolean }) => {
            // Pruning: If we can't possibly beat the best score even if we take all remaining valid melds...
            // (Complex to calculate accurately, so skipping for now given small N)

            // Update Best
            if (currentStats.cards > bestStats.cards) {
                bestSolution = [...currentMelds];
                bestStats = { ...currentStats };
            } else if (currentStats.cards === bestStats.cards) {
                // Tie-breaker: Pure Run (if needed)
                if (!this.hasOpened) {
                    if (currentStats.hasPure && !bestStats.hasPure) {
                        bestSolution = [...currentMelds];
                        bestStats = { ...currentStats };
                    } else if (currentStats.hasPure === bestStats.hasPure) {
                        if (currentStats.points > bestStats.points) {
                            bestSolution = [...currentMelds];
                            bestStats = { ...currentStats };
                        }
                    }
                } else {
                    // Tie-breaker: Points
                    if (currentStats.points > bestStats.points) {
                        bestSolution = [...currentMelds];
                        bestStats = { ...currentStats };
                    }
                }
            }

            for (let i = index; i < candidates.length; i++) {
                const cand = candidates[i];

                // Check overlap
                let overlap = false;
                for (const id of cand.mask) {
                    if (usedIds.has(id)) {
                        overlap = true;
                        break;
                    }
                }

                if (!overlap) {
                    // Add
                    cand.mask.forEach(id => usedIds.add(id));
                    currentMelds.push(cand.meld);
                    const newStats = {
                        cards: currentStats.cards + cand.meld.length,
                        points: currentStats.points + cand.points,
                        hasPure: currentStats.hasPure || (cand.isPure ?? false)
                    };

                    search(i + 1, currentMelds, usedIds, newStats);

                    // Backtrack
                    currentMelds.pop();
                    cand.mask.forEach(id => usedIds.delete(id));
                }
            }
        };

        search(0, [], new Set(), { cards: 0, points: 0, hasPure: false });

        return bestSolution;
    }

    // --- Discard Logic ---

    private fitsOnTable(card: ICard): boolean {
        // Simple check: Try adding card to every existing meld
        for (const meld of this.tableMelds) {
            const candidates = [...meld, card];

            // We must instantiate real Card objects so they have methods like getOrder()
            // Otherwise validateMeld will crash.
            const safeCandidates = candidates.map(c => {
                const clone = new Card(c.suit, c.rank, c.id);
                // Important: Clone representation object if exists so we don't mutate state
                if (c.representation) clone.representation = { ...c.representation };
                return clone;
            });

            const organized = organizeMeld(safeCandidates);
            const res = validateMeld(organized);
            if (res.valid) return true;
        }
        return false;
    }

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

        // HARD/MEDIUM: Base Synergy + Strategic Penalties
        const scores = nonJokers.map(card => {
            let synergy = 0;

            // Base Synergy: Pairs
            const sameRank = nonJokers.filter(c => c.id !== card.id && c.rank === card.rank).length;
            synergy += sameRank * 5;

            // Base Synergy: Neighbors
            const sameSuit = nonJokers.filter(c => c.id !== card.id && c.suit === card.suit);
            const neighbors = sameSuit.filter(c => Math.abs(c.getOrder() - card.getOrder()) <= 2).length;
            synergy += neighbors * 3;

            // Base Value (Prefer discarding high value cards)
            // Score = "Value of KEEPING this card"
            // So negative value for keeping a high-point card (we want to dump it)
            let score = synergy - (card.getValue() * 0.5);

            // HARD MODE EXCLUSIVE: Board Awareness
            if (this.difficulty === 'hard') {
                if (this.fitsOnTable(card)) {
                    // This card is VERY dangerous to discard
                    // Penalty depends on Opponent Hand Size
                    if (this.opponentHandSize <= 2) {
                        score += 1000; // Do NOT discard (Keep score very high)
                    } else {
                        score += 20; // Prefer not to discard, but okay if desperate
                    }
                }
            }

            return { card, score };
        });

        // Sort by Score ascending (Lowest score = Best candidate to discard)
        scores.sort((a, b) => a.score - b.score);

        return scores[0].card;
    }
}
