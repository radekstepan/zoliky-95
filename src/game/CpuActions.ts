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
    // CPU always draws from stock for simplicity in this implementation
    drawCard(state, 'stock');
    const meldsPlayed: ICard[][] = [];

    // If draw failed (deck empty?), check if we have cards to play/discard.
    // If hand is empty after failed draw (shouldn't happen with correct flow), win?
    // But typically draw failures replenish from discard.
    
    if (state.round >= 3) {
        const move = calculateCpuMove(state.cHand, state.hasOpened.cpu, state.melds, state.difficulty);

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
                        drawSource: 'stock',
                        meldsPlayed 
                    };
                }
                
                state.round++;
                state.turn = 'human';
                state.phase = 'draw';
                resetTurnState(state);
                return { 
                    discardedCard: d, 
                    drawSource: 'stock',
                    meldsPlayed 
                };
            }
        }
    }
    
    // Fallback: Random discard if logic fails, round < 3, or calculateCpuMove returned null discard
    if (state.cHand.length > 0) {
        const randIdx = Math.floor(Math.random() * state.cHand.length);
        const disc = state.cHand.splice(randIdx, 1)[0];
        state.discardPile.push(disc);
        
        if (state.cHand.length === 0) {
             return { winner: "CPU", score: state.pHand.length * -1, discardedCard: disc, drawSource: 'stock', meldsPlayed };
        }

        state.round++;
        state.turn = 'human';
        state.phase = 'draw';
        resetTurnState(state);
        return { discardedCard: disc, drawSource: 'stock', meldsPlayed };
    }

    // Should only reach here if hand is empty but didn't trigger win previously
    return { winner: "CPU", score: state.pHand.length * -1, drawSource: 'stock', meldsPlayed };
}
