import { IGameState, ICard } from "../types";
import { calculateCpuMove } from "../core/ai";
import { validateMeld, organizeMeld } from "../core/rules";
import { drawCard, resetTurnState } from "./TurnActions";
import { attemptJokerSwap } from "./MeldActions";

export interface CpuTurnResult {
    winner?: string;
    score?: number;
    discardedCard?: ICard;
    drawSource?: 'stock' | 'discard';
    meldsPlayed?: ICard[][];
}

export function processCpuTurn(state: IGameState): CpuTurnResult {
    // Check discard pile for Joker
    const topDiscard = state.discardPile[state.discardPile.length - 1];
    let drawnFromDiscard = false;

    if (topDiscard && topDiscard.isJoker) {
        const res = drawCard(state, 'discard');
        if (res.success) drawnFromDiscard = true;
    }

    if (!drawnFromDiscard) {
        drawCard(state, 'stock');
    }
    const meldsPlayed: ICard[][] = [];

    const actualDrawSource = drawnFromDiscard ? 'discard' : 'stock';

    if (state.round >= 3) {
        // Pass opponent (player) hand size for AI defense logic
        const move = calculateCpuMove(
            state.cHand,
            state.hasOpened.cpu,
            state.melds,
            state.difficulty,
            state.pHand.length
        );

        if (move.jokerSwaps && move.jokerSwaps.length > 0) {
            const swap = move.jokerSwaps[0];
            attemptJokerSwap(state, swap.meldIndex, swap.handCardId);
        }

        // Apply Melds
        move.meldsToPlay.forEach(meld => {
            if (!state.hasOpened.cpu) {
                const res = validateMeld(meld);
                if (res.type === 'run' && res.isPure) state.hasPureRun.cpu = true;
            }

            const organized = organizeMeld(meld);
            state.melds.push(organized);
            meldsPlayed.push(organized);
            // Remove from hand by reference/ID
            const meldIds = meld.map(c => c.id);
            state.cHand = state.cHand.filter(c => !meldIds.includes(c.id));
        });

        if (!state.hasOpened.cpu && move.meldsToPlay.length > 0) {
            state.hasOpened.cpu = true;
        }

        // Apply Discard
        if (move.discardCard) {
            const d = move.discardCard;
            if (state.cHand.some(c => c.id === d.id)) {
                state.cHand = state.cHand.filter(c => c.id !== d.id);
                state.discardPile.push(d);

                if (state.cHand.length === 0) {
                    return {
                        winner: "CPU",
                        score: state.pHand.length * -1,
                        discardedCard: d,
                        drawSource: actualDrawSource,
                        meldsPlayed
                    };
                }

                state.round++;
                state.turn = 'human';
                state.phase = 'draw';
                resetTurnState(state);
                return {
                    discardedCard: d,
                    drawSource: actualDrawSource,
                    meldsPlayed
                };
            }
        }
    }

    // Fallback: Random discard
    if (state.cHand.length > 0) {
        const randIdx = Math.floor(Math.random() * state.cHand.length);
        const disc = state.cHand.splice(randIdx, 1)[0];
        state.discardPile.push(disc);

        if (state.cHand.length === 0) {
            return { winner: "CPU", score: state.pHand.length * -1, discardedCard: disc, drawSource: actualDrawSource, meldsPlayed };
        }

        state.round++;
        state.turn = 'human';
        state.phase = 'draw';
        resetTurnState(state);
        return { discardedCard: disc, drawSource: actualDrawSource, meldsPlayed };
    }

    return { winner: "CPU", score: state.pHand.length * -1, drawSource: actualDrawSource, meldsPlayed };
}
