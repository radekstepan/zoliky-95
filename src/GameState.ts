import { Deck } from "./core/Deck";
import { Card } from "./core/Card";
import { ICard, TurnOwner, TurnPhase } from "./types";
import { sortHandLogic, validateMeld } from "./core/rules";
import { calculateCpuMove } from "./core/ai";

export class GameState {
    public deck: Deck;
    public pHand: ICard[] = [];
    public cHand: ICard[] = [];
    public melds: ICard[][] = [];
    public discardPile: ICard[] = [];
    
    public turn: TurnOwner = 'human';
    public phase: TurnPhase = 'draw';
    public round: number = 1;
    
    public hasOpened = { human: false, cpu: false };

    // Turn-specific state tracking
    public turnMelds: number[] = []; // Indices of melds created this turn
    public turnPoints: number = 0;
    public drawnFromDiscardId: number | null = null;
    public discardCardUsed: boolean = false;

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
        this.round = 1;
        this.resetTurnState();

        // Deal 12 cards
        for(let i=0; i<12; i++) {
            const pc = this.deck.draw();
            const cc = this.deck.draw();
            if (pc) this.pHand.push(pc);
            if (cc) this.cHand.push(cc);
        }

        sortHandLogic(this.pHand);
        sortHandLogic(this.cHand);

        const firstDisc = this.deck.draw();
        if (firstDisc) this.discardPile.push(firstDisc);

        this.turn = 'human';
        this.phase = 'draw';
    }

    public resetTurnState() {
        this.turnMelds = [];
        this.turnPoints = 0;
        this.drawnFromDiscardId = null;
        this.discardCardUsed = false;
    }

    public drawCard(source: 'stock' | 'discard'): { success: boolean; card?: ICard; msg?: string } {
        if (this.phase !== 'draw') return { success: false };

        let card: ICard | undefined;

        if (source === 'stock') {
            card = this.deck.draw();
            if (!card) {
                // Reshuffle discard if empty
                if (this.discardPile.length > 0) {
                    const top = this.discardPile.pop()!;
                    // Cast ICard[] back to Card[] for the Deck class. 
                    // In a strict app, we'd ensure types match perfectly or clone.
                    this.deck.setCards(this.discardPile as Card[]);
                    this.deck.shuffle();
                    this.discardPile = [top];
                    card = this.deck.draw();
                } else {
                    return { success: false, msg: "Deck Empty" };
                }
            }
        } else {
            if (this.discardPile.length === 0) return { success: false };
            card = this.discardPile.pop();
            if (card) this.drawnFromDiscardId = card.id;
        }

        if (!card) return { success: false, msg: "Error drawing card" };

        if (this.turn === 'human') {
            this.pHand.push(card);
            sortHandLogic(this.pHand);
        } else {
            this.cHand.push(card);
            sortHandLogic(this.cHand);
        }

        this.phase = 'action';
        return { success: true, card };
    }

    public attemptMeld(selectedCards: ICard[]): { success: boolean; msg?: string } {
        if (this.round < 3) return { success: false, msg: `Cannot meld until Round 3.` };
        if (selectedCards.length < 3) return { success: false, msg: "Meld must be 3+ cards." };

        const result = validateMeld(selectedCards);
        if (!result.valid) return { success: false, msg: "Invalid Meld (Set or Run required)." };

        // Check Discard constraint
        if (this.drawnFromDiscardId) {
            const used = selectedCards.some(c => c.id === this.drawnFromDiscardId);
            if (used) this.discardCardUsed = true;
        }

        this.melds.push(selectedCards);
        this.turnMelds.push(this.melds.length - 1);
        this.turnPoints += result.points;

        // Remove from hand
        const ids = selectedCards.map(c => c.id);
        this.pHand = this.pHand.filter(c => !ids.includes(c.id));

        return { success: true };
    }

    public cancelTurnMelds() {
        // Iterate backwards
        for (let i = this.turnMelds.length - 1; i >= 0; i--) {
            const idx = this.turnMelds[i];
            const cards = this.melds[idx];
            this.pHand.push(...cards);
            this.melds.splice(idx, 1);
        }
        
        sortHandLogic(this.pHand);
        this.pHand.forEach(c => c.selected = false);
        
        // Reset turn tracking
        this.turnMelds = [];
        this.turnPoints = 0;
        this.discardCardUsed = false;
    }

    public attemptDiscard(cardId: number): { success: boolean; msg?: string; winner?: string } {
        // 1. Check Opening constraint
        if (!this.hasOpened.human && this.turnMelds.length > 0) {
            if (this.turnPoints < 36) {
                return { success: false, msg: `Opening melds must sum to 36+. Current: ${this.turnPoints}` };
            }
            this.hasOpened.human = true;
            this.turnMelds = []; // Commit
        }

        // 2. Check Discard Pickup constraint
        if (this.drawnFromDiscardId && !this.discardCardUsed) {
            // Ensure they didn't just discard the card they picked up (which would put it back on top)
            // Actually, rule says "Must use in meld". 
            return { success: false, msg: "Must meld the card picked from discard pile." };
        }

        const cardIdx = this.pHand.findIndex(c => c.id === cardId);
        if (cardIdx === -1) return { success: false, msg: "Card not found" };

        const card = this.pHand.splice(cardIdx, 1)[0];
        card.selected = false;
        this.discardPile.push(card);

        if (this.pHand.length === 0) {
            return { success: true, winner: 'Human' };
        }

        // Switch Turn
        this.turn = 'cpu';
        this.phase = 'draw';
        this.resetTurnState();
        
        return { success: true };
    }

    public addToExistingMeld(meldIndex: number, selectedCards: ICard[]): { success: boolean; msg?: string; winner?: string } {
        if (!this.hasOpened.human) return { success: false, msg: "Must open (36pts) before adding to melds." };
        
        const targetMeld = [...this.melds[meldIndex]];
        const candidates = [...targetMeld, ...selectedCards];

        const res = validateMeld(candidates);
        if (!res.valid) return { success: false, msg: "Cannot add cards to this meld." };

        if (this.drawnFromDiscardId) {
            if (selectedCards.some(c => c.id === this.drawnFromDiscardId)) {
                this.discardCardUsed = true;
            }
        }

        this.melds[meldIndex] = candidates;
        const ids = selectedCards.map(c => c.id);
        this.pHand = this.pHand.filter(c => !ids.includes(c.id));

        if (this.pHand.length === 0) return { success: true, winner: "Human" };
        
        return { success: true };
    }

    public processCpuTurn(): { winner?: string } {
        // 1. Draw
        this.drawCard('stock'); // CPU simple strategy: always draw stock for now

        // 2. Calculate Logic
        // Only meld if Round >= 3
        if (this.round >= 3) {
            const move = calculateCpuMove(this.cHand, this.hasOpened.cpu);
            
            move.meldsToPlay.forEach(meld => {
                // If not opened, we validated points in calculateCpuMove
                if (!this.hasOpened.cpu) {
                    // double check just in case
                    const val = validateMeld(meld);
                    if (val.points >= 36) this.hasOpened.cpu = true;
                }
                
                this.melds.push(meld);
                this.cHand = this.cHand.filter(c => !meld.includes(c));
            });

            if (this.cHand.length === 0) return { winner: "CPU" };

            // Discard
            if (move.discardCard) {
                const d = move.discardCard;
                this.cHand = this.cHand.filter(c => c.id !== d.id);
                this.discardPile.push(d);
            }
        } else {
            // Just discard random if < Round 3
            const randIdx = Math.floor(Math.random() * this.cHand.length);
            const disc = this.cHand.splice(randIdx, 1)[0];
            this.discardPile.push(disc);
        }

        if (this.cHand.length === 0) return { winner: "CPU" };

        // End Round
        this.round++;
        this.turn = 'human';
        this.phase = 'draw';
        this.resetTurnState();

        return {};
    }
}
