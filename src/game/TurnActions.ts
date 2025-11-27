import { IGameState, ICard } from "../types";
import { sortHandLogic, validateMeld } from "../core/rules";

export function resetTurnState(state: IGameState) {
    state.turnMelds = [];
    state.turnPoints = 0;
    state.turnAdditions = [];
    state.drawnFromDiscardId = null;
    state.discardCardUsed = false;
    state.swappedJokerIds = [];
    state.isJollyTurn = false;
}

export function drawCard(state: IGameState, source: 'stock' | 'discard'): { success: boolean; card?: ICard; msg?: string } {
    if (state.phase !== 'draw') return { success: false, msg: "Already drew a card." };

    let card: ICard | undefined;

    if (source === 'stock') {
        card = state.deck.draw();
        if (!card) {
            if (state.discardPile.length > 0) {
                state.deck.setCards([...state.discardPile]);
                state.deck.shuffle();
                state.discardPile = [];
                card = state.deck.draw();
            } else {
                return { success: false, msg: "Deck Empty" };
            }
        }
    } else {
        if (state.round < 3) {
            return { success: false, msg: "Cannot draw from discard until Round 3." };
        }
        if (state.discardPile.length === 0) return { success: false };
        card = state.discardPile.pop();
        if (card) state.drawnFromDiscardId = card.id;
    }

    if (!card) return { success: false, msg: "Error drawing card" };

    if (state.turn === 'human') {
        state.pHand.push(card);
    } else {
        state.cHand.push(card);
        sortHandLogic(state.cHand);
    }

    state.phase = 'action';
    return { success: true, card };
}

export function undoDraw(state: IGameState): { success: boolean; msg?: string } {
    if (state.phase !== 'action') return { success: false, msg: "Not in action phase." };
    if (!state.drawnFromDiscardId) return { success: false, msg: "Did not draw from discard." };
    if (state.turnMelds.length > 0) return { success: false, msg: "Cannot undo after melding." };
    if (state.turnAdditions.length > 0) return { success: false, msg: "Cannot undo after adding to melds." };
    if (state.swappedJokerIds.length > 0) return { success: false, msg: "Cannot undo after swapping Jokers." };

    const cardIdx = state.pHand.findIndex(c => c.id === state.drawnFromDiscardId);
    if (cardIdx === -1) return { success: false, msg: "Card not found in hand." };

    const card = state.pHand.splice(cardIdx, 1)[0];
    card.selected = false;

    state.discardPile.push(card);
    state.drawnFromDiscardId = null;
    state.phase = 'draw';

    return { success: true };
}

export function attemptDiscard(state: IGameState, cardId: number): { success: boolean; msg?: string; winner?: string, score?: number } {
    if (state.phase !== 'action') return { success: false, msg: "Must draw/act before discarding." };

    if (state.isJollyTurn && state.pHand.length > 1) {
        return { success: false, msg: "Jolly Hand must meld ALL cards to win." };
    }

    if (!state.hasOpened.human && state.turnMelds.length > 0) {
        if (state.turnPoints < 36) {
            return { success: false, msg: `Opening melds must sum to 36+. Current: ${state.turnPoints}` };
        }
        const hasPureRun = state.turnMelds.some(idx => {
            const res = validateMeld(state.melds[idx]);
            return res.type === 'run' && res.isPure;
        });

        if (!hasPureRun) return { success: false, msg: "Opening requires at least 1 Pure Run (Straight Flush)." };

        state.hasOpened.human = true;
        state.turnMelds = [];
        state.turnAdditions = []; 
    }

    if (state.drawnFromDiscardId && !state.discardCardUsed) {
        return { success: false, msg: "Must meld the card picked from discard pile." };
    }

    if (state.swappedJokerIds.some(id => state.pHand.some(c => c.id === id && c.id !== cardId))) {
        return { success: false, msg: "Must meld the Swapped Joker(s)." };
    }
    if (state.swappedJokerIds.includes(cardId)) {
        return { success: false, msg: "Cannot discard a Swapped Joker. Must meld it." };
    }

    const cardIdx = state.pHand.findIndex(c => c.id === cardId);
    if (cardIdx === -1) return { success: false, msg: "Card not found" };

    const card = state.pHand.splice(cardIdx, 1)[0];
    card.selected = false;

    state.discardPile.push(card);

    if (state.pHand.length === 0) {
        if (!state.hasOpened.human && !state.isJollyTurn) {
            state.discardPile.pop();
            state.pHand.push(card);
            return { success: false, msg: "Cannot win without opening requirements (36pts + Pure Run)." };
        }

        return { success: true, winner: 'Human', score: state.cHand.length * -1 };
    }

    state.turn = 'cpu';
    state.phase = 'draw';
    resetTurnState(state);
    return { success: true };
}
