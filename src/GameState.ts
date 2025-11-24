import { Deck } from "./core/Deck";
import { ICard, TurnOwner, TurnPhase } from "./types";
import { sortHandLogic, validateMeld, organizeMeld } from "./core/rules";
import { calculateCpuMove } from "./core/ai";

export class GameState {
    public deck: Deck;
    public pHand: ICard[] = [];
    public cHand: ICard[] = [];
    public melds: ICard[][] = [];
    public discardPile: ICard[] = [];
    public bottomCard: ICard | null = null;

    public turn: TurnOwner = 'human';
    public phase: TurnPhase = 'draw';
    public round: number = 1;

    public hasOpened = { human: false, cpu: false };
    public hasPureRun = { human: false, cpu: false };

    public turnMelds: number[] = [];
    public turnPoints: number = 0;

    public drawnFromDiscardId: number | null = null;
    public discardCardUsed: boolean = false;
    public swappedJokerIds: number[] = [];
    public isJollyTurn: boolean = false;

    constructor() {
        this.deck = new Deck();
    }

    public initGame() {
        this.deck.init();
        this.pHand = [];
        this.cHand = [];
        this.melds = [];
        this.discardPile = [];
        this.hasOpened = { human: false, cpu: false };
        this.hasPureRun = { human: false, cpu: false };
        this.round = 1;
        this.resetTurnState();

        const cutJokers = this.deck.checkBottomThreeForJokers();
        if (cutJokers.length > 0) {
            this.pHand.push(...cutJokers);
        }

        this.bottomCard = this.deck.removeBottom() || null;

        while (this.pHand.length < 13) {
            const c = this.deck.draw();
            if (c) this.pHand.push(c);
        }
        while (this.cHand.length < 12) {
            const c = this.deck.draw();
            if (c) this.cHand.push(c);
        }

        // Initial sort for convenience
        sortHandLogic(this.pHand);
        sortHandLogic(this.cHand);

        this.turn = 'human';
        this.phase = 'action';
    }

    public resetTurnState() {
        this.turnMelds = [];
        this.turnPoints = 0;
        this.drawnFromDiscardId = null;
        this.discardCardUsed = false;
        this.swappedJokerIds = [];
        this.isJollyTurn = false;
    }

    // New: Handle manual reordering
    public reorderHand(fromIndex: number, toIndex: number) {
        if (fromIndex < 0 || fromIndex >= this.pHand.length || toIndex < 0 || toIndex >= this.pHand.length) return;
        const [card] = this.pHand.splice(fromIndex, 1);
        this.pHand.splice(toIndex, 0, card);
    }

    public drawCard(source: 'stock' | 'discard'): { success: boolean; card?: ICard; msg?: string } {
        if (this.phase !== 'draw') return { success: false };

        let card: ICard | undefined;

        if (source === 'stock') {
            card = this.deck.draw();
            if (!card) {
                if (this.discardPile.length > 0) {
                    this.deck.setCards([...this.discardPile]);
                    this.deck.shuffle();
                    this.discardPile = [];
                    card = this.deck.draw();
                } else {
                    return { success: false, msg: "Deck Empty" };
                }
            }
        } else {
            if (this.round < 3) {
                return { success: false, msg: "Cannot draw from discard until Round 3." };
            }
            if (this.discardPile.length === 0) return { success: false };
            card = this.discardPile.pop();
            if (card) this.drawnFromDiscardId = card.id;
        }

        if (!card) return { success: false, msg: "Error drawing card" };

        if (this.turn === 'human') {
            this.pHand.push(card);
            // No auto-sort for human to enable manual sorting
        } else {
            this.cHand.push(card);
            sortHandLogic(this.cHand);
        }

        this.phase = 'action';
        return { success: true, card };
    }

    public undoDraw(): { success: boolean; msg?: string } {
        if (this.phase !== 'action') return { success: false, msg: "Not in action phase." };
        if (!this.drawnFromDiscardId) return { success: false, msg: "Did not draw from discard." };
        if (this.turnMelds.length > 0) return { success: false, msg: "Cannot undo after melding." };
        if (this.swappedJokerIds.length > 0) return { success: false, msg: "Cannot undo after swapping Jokers." };

        const cardIdx = this.pHand.findIndex(c => c.id === this.drawnFromDiscardId);
        if (cardIdx === -1) return { success: false, msg: "Card not found in hand." };

        const card = this.pHand.splice(cardIdx, 1)[0];
        card.selected = false;

        this.discardPile.push(card);

        this.drawnFromDiscardId = null;
        this.phase = 'draw';

        return { success: true };
    }

    private checkRequirementUsage(cards: ICard[]) {
        if (this.drawnFromDiscardId) {
            if (cards.some(c => c.id === this.drawnFromDiscardId)) {
                this.discardCardUsed = true;
            }
        }
        if (this.swappedJokerIds.length > 0) {
            const usedJokers = cards.filter(c => this.swappedJokerIds.includes(c.id));
            usedJokers.forEach(j => {
                const idx = this.swappedJokerIds.indexOf(j.id);
                if (idx > -1) this.swappedJokerIds.splice(idx, 1);
            });
        }
    }

    public attemptMeld(selectedCards: ICard[]): { success: boolean; msg?: string } {
        if (this.round < 3) return { success: false, msg: `Cannot meld until Round 3.` };

        const result = validateMeld(selectedCards);
        if (!result.valid) return { success: false, msg: "Invalid Meld. Check suits/ranks/adjacency." };

        this.checkRequirementUsage(selectedCards);

        const organized = organizeMeld(selectedCards);

        this.melds.push(organized);
        this.turnMelds.push(this.melds.length - 1);
        this.turnPoints += result.points;

        const ids = selectedCards.map(c => c.id);
        this.pHand = this.pHand.filter(c => !ids.includes(c.id));

        return { success: true };
    }

    public attemptJokerSwap(meldIndex: number, handCardId: number): { success: boolean; msg?: string } {
        if (this.turn === 'human' && !this.hasOpened.human) return { success: false, msg: "Must open before swapping Jokers." };
        if (this.turn === 'cpu' && !this.hasOpened.cpu) return { success: false, msg: "CPU must open before swap." };

        const meld = [...this.melds[meldIndex]];
        const jokerIdx = meld.findIndex(c => c.isJoker);
        if (jokerIdx === -1) return { success: false, msg: "No Joker in selected meld." };

        const joker = meld[jokerIdx];

        // Joker must have a representation (fixed position)
        if (!joker.representation) {
            return { success: false, msg: "Joker position not set." };
        }

        const hand = this.turn === 'human' ? this.pHand : this.cHand;
        const handCard = hand.find(c => c.id === handCardId);
        if (!handCard) return { success: false, msg: "Card not in hand." };

        // The hand card MUST exactly match the Joker's representation
        if (handCard.rank !== joker.representation.rank || handCard.suit !== joker.representation.suit) {
            return {
                success: false,
                msg: `Joker represents ${joker.representation.rank}${joker.representation.suit}. You need that exact card to swap.`
            };
        }

        // Swap the cards
        meld[jokerIdx] = handCard;

        // Validate the meld still works with the swap
        const organized = organizeMeld(meld);
        const res = validateMeld(organized);
        if (!res.valid) return { success: false, msg: "Card does not fit in meld." };

        this.melds[meldIndex] = organized;

        if (this.turn === 'human') {
            this.pHand = this.pHand.filter(c => c.id !== handCardId);
            joker.representation = undefined;
            joker.selected = false;
            this.pHand.push(joker);
            this.swappedJokerIds.push(joker.id);
            // No auto sort for human
        } else {
            this.cHand = this.cHand.filter(c => c.id !== handCardId);
            joker.representation = undefined;
            this.cHand.push(joker);
            sortHandLogic(this.cHand);
        }

        return { success: true };
    }

    public attemptJollyHand(): { success: boolean; msg?: string; winner?: string } {
        if (this.round < 3) return { success: false, msg: "Cannot take Jolly Hand until Round 3." };
        if (this.pHand.length !== 12) return { success: false, msg: "Need exactly 12 cards to take Jolly Hand." };
        if (!this.bottomCard) return { success: false, msg: "No bottom card available." };
        if (this.phase !== 'draw') return { success: false, msg: "Can only take Jolly Hand at start of turn." };

        this.pHand.push(this.bottomCard);
        this.bottomCard = null;
        this.phase = 'action';
        this.isJollyTurn = true;

        return { success: true, msg: "Jolly Hand! You must meld ALL cards now to win." };
    }

    public cancelTurnMelds() {
        for (let i = this.turnMelds.length - 1; i >= 0; i--) {
            const idx = this.turnMelds[i];
            const cards = this.melds[idx];
            cards.forEach(c => c.representation = undefined);
            this.pHand.push(...cards);
            this.melds.splice(idx, 1);
        }

        this.pHand.forEach(c => c.selected = false);
        this.turnMelds = [];
        this.turnPoints = 0;

        this.discardCardUsed = false;
    }

    public attemptDiscard(cardId: number): { success: boolean; msg?: string; winner?: string, score?: number } {
        if (this.isJollyTurn && this.pHand.length > 1) {
            return { success: false, msg: "Jolly Hand must meld ALL cards to win." };
        }

        if (!this.hasOpened.human && this.turnMelds.length > 0) {
            if (this.turnPoints < 36) {
                return { success: false, msg: `Opening melds must sum to 36+. Current: ${this.turnPoints}` };
            }
            const hasPureRun = this.turnMelds.some(idx => {
                const res = validateMeld(this.melds[idx]);
                return res.type === 'run' && res.isPure;
            });

            if (!hasPureRun) return { success: false, msg: "Opening requires at least 1 Pure Run (Straight Flush)." };

            this.hasOpened.human = true;
            this.turnMelds = [];
        }

        if (this.drawnFromDiscardId && !this.discardCardUsed) {
            return { success: false, msg: "Must meld the card picked from discard pile." };
        }

        if (this.swappedJokerIds.some(id => this.pHand.some(c => c.id === id && c.id !== cardId))) {
            return { success: false, msg: "Must meld the Swapped Joker(s)." };
        }
        if (this.swappedJokerIds.includes(cardId)) {
            return { success: false, msg: "Cannot discard a Swapped Joker. Must meld it." };
        }

        const cardIdx = this.pHand.findIndex(c => c.id === cardId);
        if (cardIdx === -1) return { success: false, msg: "Card not found" };

        const card = this.pHand.splice(cardIdx, 1)[0];
        card.selected = false;

        if (this.pHand.length === 0) {
            return { success: true, winner: 'Human', score: this.cHand.length * -1 };
        }

        this.discardPile.push(card);
        this.turn = 'cpu';
        this.phase = 'draw';
        this.resetTurnState();
        return { success: true };
    }

    public addToExistingMeld(meldIndex: number, selectedCards: ICard[]): { success: boolean; msg?: string; winner?: string } {
        if (!this.hasOpened.human) return { success: false, msg: "Must open before adding to melds." };

        const targetMeld = [...this.melds[meldIndex]];
        const candidates = [...targetMeld, ...selectedCards];

        const organized = organizeMeld(candidates);

        const res = validateMeld(organized);
        if (!res.valid) return { success: false, msg: "Cannot add cards to this meld." };

        this.checkRequirementUsage(selectedCards);

        this.melds[meldIndex] = organized;
        const ids = selectedCards.map(c => c.id);
        this.pHand = this.pHand.filter(c => !ids.includes(c.id));

        if (this.pHand.length === 0) return { success: true, winner: "Human" };

        return { success: true };
    }

    public processCpuTurn(): { winner?: string, score?: number, discardedCard?: ICard, drawSource?: 'stock' | 'discard' } {
        this.drawCard('stock');

        if (this.round >= 3) {
            const move = calculateCpuMove(this.cHand, this.hasOpened.cpu, this.melds);

            if (move.jokerSwaps && move.jokerSwaps.length > 0) {
                const swap = move.jokerSwaps[0];
                this.attemptJokerSwap(swap.meldIndex, swap.handCardId);
            }

            move.meldsToPlay.forEach(meld => {
                if (!this.hasOpened.cpu) {
                    const res = validateMeld(meld);
                    if (res.type === 'run' && res.isPure) this.hasPureRun.cpu = true;
                }

                const organized = organizeMeld(meld);
                this.melds.push(organized);
                this.cHand = this.cHand.filter(c => !meld.includes(c));
            });

            if (!this.hasOpened.cpu && move.meldsToPlay.length > 0) {
                this.hasOpened.cpu = true;
            }

            if (move.discardCard) {
                const d = move.discardCard;
                if (this.cHand.some(c => c.id === d.id)) {
                    this.cHand = this.cHand.filter(c => c.id !== d.id);
                    if (this.cHand.length === 0) return { winner: "CPU", score: this.pHand.length * -1, discardedCard: d, drawSource: 'stock' };
                    this.discardPile.push(d);
                    this.round++;
                    this.turn = 'human';
                    this.phase = 'draw';
                    this.resetTurnState();
                    return { discardedCard: d, drawSource: 'stock' };
                } else {
                    if (this.cHand.length > 0) {
                        const rand = this.cHand.pop()!;
                        this.discardPile.push(rand);
                        this.round++;
                        this.turn = 'human';
                        this.phase = 'draw';
                        this.resetTurnState();
                        return { discardedCard: rand, drawSource: 'stock' };
                    } else {
                        return { winner: "CPU", score: this.pHand.length * -1, drawSource: 'stock' };
                    }
                }
            }
        } else {
            const randIdx = Math.floor(Math.random() * this.cHand.length);
            const disc = this.cHand.splice(randIdx, 1)[0];
            this.discardPile.push(disc);
            this.round++;
            this.turn = 'human';
            this.phase = 'draw';
            this.resetTurnState();
            return { discardedCard: disc, drawSource: 'stock' };
        }

        return { drawSource: 'stock' };
    }
}
