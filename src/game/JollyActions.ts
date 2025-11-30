import { IGameState } from "../types";

export function attemptJollyHand(state: IGameState): { success: boolean; msg?: string; winner?: string } {
    if (state.round < 3) return { success: false, msg: "Cannot take Jolly Hand until Round 3." };
    if (state.hasOpened.human) return { success: false, msg: "Cannot take Jolly Hand after opening." };
    if (state.pHand.length !== 12) return { success: false, msg: "Need exactly 12 cards to take Jolly Hand." };
    if (!state.bottomCard) return { success: false, msg: "No bottom card available." };
    if (state.phase !== 'draw') return { success: false, msg: "Can only take Jolly Hand at start of turn." };

    state.pHand.push(state.bottomCard);
    state.bottomCard = null;
    state.phase = 'action';
    state.isJollyTurn = true;

    return { success: true, msg: "Jolly Hand! You must meld ALL cards now to win." };
}

export function undoJolly(state: IGameState): { success: boolean; msg?: string } {
    if (state.phase !== 'action') return { success: false, msg: "Not in action phase." };
    if (!state.isJollyTurn) return { success: false, msg: "Did not take Jolly Hand." };
    if (state.turnMelds.length > 0) return { success: false, msg: "Cannot undo after melding." };
    if (state.turnAdditions.length > 0) return { success: false, msg: "Cannot undo after adding to melds." };
    if (state.swappedJokerIds.length > 0) return { success: false, msg: "Cannot undo after swapping Jokers." };

    if (state.pHand.length === 0) return { success: false, msg: "No cards in hand." };

    // Remove last card (the Jolly card)
    const card = state.pHand.pop()!;
    card.selected = false;

    // Return it as bottom card
    state.bottomCard = card;
    state.isJollyTurn = false;
    state.phase = 'draw';

    return { success: true };
}
