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
