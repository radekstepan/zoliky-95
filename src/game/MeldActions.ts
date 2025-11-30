import { IGameState, ICard } from "../types";
import { validateMeld, organizeMeld, sortHandLogic } from "../core/rules";

// --- Helpers ---

function recalculateTurnPoints(state: IGameState) {
    let total = 0;

    // Count points from new melds created this turn
    state.turnMelds.forEach(idx => {
        if (state.melds[idx]) {
            const res = validateMeld(state.melds[idx]);
            if (res.valid) total += res.points;
        }
    });

    // Count points from cards added to existing melds this turn
    // For each addition, sum up the individual card values
    state.turnAdditions.forEach(addition => {
        addition.cards.forEach(card => {
            total += card.getValue();
        });
    });

    state.turnPoints = total;
}

function checkRequirementUsage(state: IGameState, cards: ICard[]) {
    if (state.drawnFromDiscardId) {
        if (cards.some(c => c.id === state.drawnFromDiscardId)) {
            state.discardCardUsed = true;
        }
    }
    if (state.swappedJokerIds.length > 0) {
        const usedJokers = cards.filter(c => state.swappedJokerIds.includes(c.id));
        usedJokers.forEach(j => {
            const idx = state.swappedJokerIds.indexOf(j.id);
            if (idx > -1) state.swappedJokerIds.splice(idx, 1);
        });
    }
}

// --- Actions ---

export function attemptMeld(state: IGameState, selectedCards: ICard[]): { success: boolean; msg?: string } {
    if (state.phase !== 'action') return { success: false, msg: "Must draw a card first." };
    if (state.round < 3) return { success: false, msg: `Cannot meld until Round 3.` };

    // Reset representation for hand cards
    selectedCards.forEach(c => c.representation = undefined);

    const result = validateMeld(selectedCards);
    if (!result.valid) return { success: false, msg: "Invalid Meld. Check suits/ranks/adjacency." };

    checkRequirementUsage(state, selectedCards);

    const organized = organizeMeld(selectedCards);

    state.melds.push(organized);
    state.turnMelds.push(state.melds.length - 1);

    recalculateTurnPoints(state);

    const ids = selectedCards.map(c => c.id);
    state.pHand = state.pHand.filter(c => !ids.includes(c.id));

    return { success: true };
}

export function addToExistingMeld(state: IGameState, meldIndex: number, selectedCards: ICard[]): { success: boolean; msg?: string; winner?: string } {
    if (state.phase !== 'action') return { success: false, msg: "Must draw a card first." };

    const isCreatedThisTurn = state.turnMelds.includes(meldIndex);

    // If not created this turn, check if opening conditions are already met
    // Player must have 36+ points AND a pure run from NEW melds BEFORE adding to existing melds
    if (!isCreatedThisTurn && !state.hasOpened.human) {
        if (state.turnPoints < 36) {
            return { success: false, msg: `Must have 36+ points to open before adding to existing melds. Current: ${state.turnPoints}` };
        }

        // Still need at least one pure run in turnMelds
        const hasPureRun = state.turnMelds.some(idx => {
            if (idx >= state.melds.length) return false;
            const res = validateMeld(state.melds[idx]);
            return res.type === 'run' && res.isPure;
        });

        if (!hasPureRun) {
            return { success: false, msg: "Opening requires at least 1 Pure Run." };
        }
    }

    selectedCards.forEach(c => c.representation = undefined);

    const targetMeld = [...state.melds[meldIndex]];
    const candidates = [...targetMeld, ...selectedCards];

    const organized = organizeMeld(candidates);

    const res = validateMeld(organized);
    if (!res.valid) {
        selectedCards.forEach(c => c.representation = undefined);
        return { success: false, msg: "Cannot add cards to this meld." };
    }

    checkRequirementUsage(state, selectedCards);

    if (!isCreatedThisTurn) {
        state.turnAdditions.push({ meldIndex, cards: [...selectedCards] });
    }

    state.melds[meldIndex] = organized;

    // Always recalculate points when adding cards (whether to new or existing melds)
    // This ensures turnAdditions are counted toward opening requirements
    recalculateTurnPoints(state);

    const ids = selectedCards.map(c => c.id);
    state.pHand = state.pHand.filter(c => !ids.includes(c.id));

    if (state.pHand.length === 0) return { success: true, winner: "Human" };

    return { success: true };
}

export function attemptJokerSwap(state: IGameState, meldIndex: number, handCardId: number): { success: boolean; msg?: string } {
    if (state.phase !== 'action') return { success: false, msg: "Must draw a card first." };
    if (state.turn === 'human' && !state.hasOpened.human) return { success: false, msg: "Must open before swapping Jokers." };
    if (state.turn === 'cpu' && !state.hasOpened.cpu) return { success: false, msg: "CPU must open before swap." };

    const meld = [...state.melds[meldIndex]];
    const jokerIdx = meld.findIndex(c => c.isJoker);
    if (jokerIdx === -1) return { success: false, msg: "No Joker in selected meld." };

    const joker = meld[jokerIdx];

    if (!joker.representation) {
        return { success: false, msg: "Joker position not set." };
    }

    const hand = state.turn === 'human' ? state.pHand : state.cHand;
    const handCard = hand.find(c => c.id === handCardId);
    if (!handCard) return { success: false, msg: "Card not in hand." };

    if (handCard.rank !== joker.representation.rank || handCard.suit !== joker.representation.suit) {
        return {
            success: false,
            msg: `Joker represents ${joker.representation.rank}${joker.representation.suit}. You need that exact card to swap.`
        };
    }

    // Check the meld type and size BEFORE attempting the swap
    // For runs: always allow swap
    // For sets: only allow swap if the set currently has 4 cards (including the joker)
    const currentMeldResult = validateMeld(meld);
    if (!currentMeldResult.valid) return { success: false, msg: "Invalid meld." };

    if (currentMeldResult.type === 'set' && meld.length < 4) {
        return { success: false, msg: "Can only swap Joker from a complete Set (4 cards)." };
    }

    meld[jokerIdx] = handCard;
    const organized = organizeMeld(meld);
    const res = validateMeld(organized);
    if (!res.valid) return { success: false, msg: "Card does not fit in meld." };

    state.melds[meldIndex] = organized;

    if (state.turn === 'human') {
        state.pHand = state.pHand.filter(c => c.id !== handCardId);
        joker.representation = undefined;
        joker.selected = false;
        state.pHand.push(joker);
        state.swappedJokerIds.push(joker.id);
    } else {
        state.cHand = state.cHand.filter(c => c.id !== handCardId);
        joker.representation = undefined;
        state.cHand.push(joker);
        sortHandLogic(state.cHand);
    }

    return { success: true };
}

export function cancelTurnMelds(state: IGameState) {
    // Revert additions
    for (let i = state.turnAdditions.length - 1; i >= 0; i--) {
        const { meldIndex, cards } = state.turnAdditions[i];
        const cardIds = cards.map(c => c.id);

        if (state.melds[meldIndex]) {
            const meld = state.melds[meldIndex].filter(c => !cardIds.includes(c.id));
            state.melds[meldIndex] = organizeMeld(meld);
        }

        cards.forEach(c => c.representation = undefined);
        state.pHand.push(...cards);
    }
    state.turnAdditions = [];

    // Revert new melds
    for (let i = state.turnMelds.length - 1; i >= 0; i--) {
        const idx = state.turnMelds[i];
        const cards = state.melds[idx];
        cards.forEach(c => c.representation = undefined);
        state.pHand.push(...cards);
        state.melds.splice(idx, 1);
    }

    state.pHand.forEach(c => c.selected = false);
    state.turnMelds = [];
    state.turnPoints = 0;
    state.discardCardUsed = false;
}
