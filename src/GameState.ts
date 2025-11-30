import { Deck } from "./core/Deck";
import { ICard, TurnOwner, TurnPhase, Difficulty, Rank, Suit, IGameState } from "./types";
import { sortHandLogic, validateMeld } from "./core/rules";
import { Card } from "./core/Card";

// Action Modules
import { attemptMeld, addToExistingMeld, attemptJokerSwap, cancelTurnMelds } from "./game/MeldActions";
import { drawCard, undoDraw, attemptDiscard, resetTurnState } from "./game/TurnActions";
import { processCpuTurn, CpuTurnResult } from "./game/CpuActions";
import { attemptJollyHand, undoJolly } from "./game/JollyActions";

export class GameState implements IGameState {
    public deck: Deck;
    public pHand: ICard[] = [];
    public cHand: ICard[] = [];
    public melds: ICard[][] = [];
    public discardPile: ICard[] = [];
    public bottomCard: ICard | null = null;

    public turn: TurnOwner = 'human';
    public phase: TurnPhase = 'draw';
    public round: number = 1;
    public difficulty: Difficulty = 'medium';

    public hasOpened = { human: false, cpu: false };
    public hasPureRun = { human: false, cpu: false };

    public turnMelds: number[] = [];
    public turnPoints: number = 0;
    public turnAdditions: { meldIndex: number, cards: ICard[] }[] = [];

    public drawnFromDiscardId: number | null = null;
    public discardCardUsed: boolean = false;
    public swappedJokerIds: number[] = [];
    public isJollyTurn: boolean = false;

    constructor() {
        this.deck = new Deck();
    }

    public initGame(debug: boolean = false) {
        this.deck.init();
        this.pHand = [];
        this.cHand = [];
        this.melds = [];
        this.discardPile = [];
        this.hasOpened = { human: false, cpu: false };
        this.hasPureRun = { human: false, cpu: false };
        this.round = 1;
        resetTurnState(this);

        if (debug) {
            this.pHand.push(this.deck.extractCard('Q', '♥')!);
            this.pHand.push(this.deck.extractCard('K', '♥')!);
            this.pHand.push(this.deck.extractCard('A', '♥')!);
            this.pHand.push(this.deck.extractCard('9', '♦')!);
            this.pHand.push(this.deck.extractCard('9', '♣')!);
            this.pHand.push(this.deck.extractCard('9', '♠')!);
            this.pHand.push(this.deck.extractCard('4', '♠')!);
            this.pHand.push(this.deck.extractCard('5', '♠')!);
            this.pHand.push(this.deck.extractCard('Joker', 'JK')!);
            this.pHand.push(this.deck.extractCard('J', '♦')!);
            this.pHand.push(this.deck.extractCard('J', '♣')!);
            this.pHand.push(this.deck.extractCard('Joker', 'JK')!);
            this.pHand.push(this.deck.extractCard('2', '♣')!);
            this.pHand = this.pHand.filter(c => !!c);
        } else {
            const cutJokers = this.deck.checkBottomThreeForJokers();
            if (cutJokers.length > 0) {
                this.pHand.push(...cutJokers);
            }
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

        sortHandLogic(this.pHand);
        sortHandLogic(this.cHand);

        this.turn = 'human';
        this.phase = 'action';
    }

    public setDifficulty(level: Difficulty) {
        this.difficulty = level;
    }

    // --- Helpers ---

    public isOpeningConditionMet(): boolean {
        // We replicate the logic here for UI usage, or delegate to a pure function if exported
        // For simple read-only access, this logic is fine here.
        if (this.hasOpened.human) return true;
        if (this.turnPoints < 36) return false;
        return this.turnMelds.some(idx => {
            if (idx >= this.melds.length) return false;
            const res = validateMeld(this.melds[idx]);
            return res.type === 'run' && res.isPure;
        });
    }

    public getTurnActiveCardIds(): number[] {
        const ids: number[] = [];
        this.turnAdditions.forEach(add => add.cards.forEach(c => ids.push(c.id)));
        this.turnMelds.forEach(idx => {
            if (this.melds[idx]) this.melds[idx].forEach(c => ids.push(c.id));
        });
        return ids;
    }

    public reorderHand(fromIndex: number, toIndex: number) {
        if (fromIndex < 0 || fromIndex >= this.pHand.length || toIndex < 0 || toIndex >= this.pHand.length) return;
        const [card] = this.pHand.splice(fromIndex, 1);
        this.pHand.splice(toIndex, 0, card);
    }

    public debugReplaceCard(cardId: number, rank: Rank, suit: Suit) {
        const idx = this.pHand.findIndex(c => c.id === cardId);
        if (idx !== -1) {
            const newId = 1000 + Math.floor(Math.random() * 100000);
            const newCard = new Card(suit, rank, newId);
            newCard.selected = this.pHand[idx].selected;
            this.pHand[idx] = newCard;
        }
    }

    // --- Delegated Action Methods ---

    public drawCard(source: 'stock' | 'discard') {
        return drawCard(this, source);
    }

    public undoDraw() {
        return undoDraw(this);
    }

    public attemptMeld(selectedCards: ICard[]) {
        return attemptMeld(this, selectedCards);
    }

    public addToExistingMeld(meldIndex: number, selectedCards: ICard[]) {
        return addToExistingMeld(this, meldIndex, selectedCards);
    }

    public attemptJokerSwap(meldIndex: number, handCardId: number) {
        return attemptJokerSwap(this, meldIndex, handCardId);
    }

    public cancelTurnMelds() {
        return cancelTurnMelds(this);
    }

    public attemptDiscard(cardId: number) {
        return attemptDiscard(this, cardId);
    }

    public attemptJollyHand() {
        return attemptJollyHand(this);
    }

    public undoJolly() {
        return undoJolly(this);
    }

    public processCpuTurn(): CpuTurnResult {
        return processCpuTurn(this);
    }
}
