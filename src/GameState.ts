import { Deck } from "./core/Deck";
import { Card } from "./core/Card";
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

        this.bottomCard = this.deck.removeBottom() || null;

        for(let i=0; i<13; i++) {
            const pc = this.deck.draw();
            if(pc) this.pHand.push(pc);
        }
        for(let i=0; i<12; i++) {
            const cc = this.deck.draw();
            if(cc) this.cHand.push(cc);
        }

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
    }

    public drawCard(source: 'stock' | 'discard'): { success: boolean; card?: ICard; msg?: string } {
        if (this.phase !== 'draw') return { success: false };

        let card: ICard | undefined;

        if (source === 'stock') {
            card = this.deck.draw();
            if (!card) {
                if (this.discardPile.length > 0) {
                    this.deck.setCards([...this.discardPile].reverse() as Card[]);
                    this.discardPile = [];
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
        
        const result = validateMeld(selectedCards);
        if (!result.valid) return { success: false, msg: "Invalid Meld. Check suits/ranks." };

        if (this.drawnFromDiscardId) {
            const used = selectedCards.some(c => c.id === this.drawnFromDiscardId);
            if (used) this.discardCardUsed = true;
        }

        // Organize meld (sort and label Jokers)
        const organized = organizeMeld(selectedCards);

        this.melds.push(organized);
        this.turnMelds.push(this.melds.length - 1);
        this.turnPoints += result.points;
        
        const ids = selectedCards.map(c => c.id);
        this.pHand = this.pHand.filter(c => !ids.includes(c.id));

        return { success: true };
    }

    public attemptJokerSwap(meldIndex: number, handCardId: number): { success: boolean; msg?: string } {
        if (!this.hasOpened.human) return { success: false, msg: "Must open before swapping Jokers." };
        
        const meld = [...this.melds[meldIndex]];
        const jokerIdx = meld.findIndex(c => c.isJoker);
        if (jokerIdx === -1) return { success: false, msg: "No Joker in selected meld." };

        const handCard = this.pHand.find(c => c.id === handCardId);
        if (!handCard) return { success: false, msg: "Card not in hand." };

        const joker = meld[jokerIdx];
        meld[jokerIdx] = handCard; 

        // Validate & Reorganize
        const organized = organizeMeld(meld);
        const res = validateMeld(organized);
        if (!res.valid) return { success: false, msg: "Card does not fit in meld." };

        this.melds[meldIndex] = organized;
        this.pHand = this.pHand.filter(c => c.id !== handCardId);
        
        // Reset joker representation before returning to hand
        joker.representation = undefined;
        this.pHand.push(joker); 
        
        sortHandLogic(this.pHand);

        return { success: true };
    }

    public attemptJollyHand(): { success: boolean; msg?: string; winner?: string } {
        if (this.pHand.length !== 12) return { success: false, msg: "Need exactly 12 cards." };
        if (!this.bottomCard) return { success: false, msg: "No bottom card available." };

        this.pHand.push(this.bottomCard);
        this.bottomCard = null; 
        sortHandLogic(this.pHand);
        this.phase = 'action'; 
        
        return { success: true, msg: "Jolly Hand! You must meld ALL cards now to win." };
    }

    public cancelTurnMelds() {
        for (let i = this.turnMelds.length - 1; i >= 0; i--) {
            const idx = this.turnMelds[i];
            const cards = this.melds[idx];
            // Reset representations
            cards.forEach(c => c.representation = undefined);
            this.pHand.push(...cards);
            this.melds.splice(idx, 1);
        }
        sortHandLogic(this.pHand);
        this.pHand.forEach(c => c.selected = false);
        this.turnMelds = [];
        this.turnPoints = 0;
        this.discardCardUsed = false;
    }

    public attemptDiscard(cardId: number): { success: boolean; msg?: string; winner?: string, score?: number } {
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

        // organizeMeld handles the sorting and representation
        const organized = organizeMeld(candidates);
        
        const res = validateMeld(organized);
        if (!res.valid) return { success: false, msg: "Cannot add cards to this meld." };

        if (this.drawnFromDiscardId) {
            if (selectedCards.some(c => c.id === this.drawnFromDiscardId)) {
                this.discardCardUsed = true;
            }
        }

        this.melds[meldIndex] = organized;
        const ids = selectedCards.map(c => c.id);
        this.pHand = this.pHand.filter(c => !ids.includes(c.id));

        if (this.pHand.length === 0) return { success: true, winner: "Human" };
        
        return { success: true };
    }

    public processCpuTurn(): { winner?: string, score?: number } {
        this.drawCard('stock'); 

        if (this.round >= 3) {
            const move = calculateCpuMove(this.cHand, this.hasOpened.cpu);
            
            move.meldsToPlay.forEach(meld => {
                if (!this.hasOpened.cpu) {
                    const res = validateMeld(meld);
                    if (res.type === 'run' && res.isPure) this.hasPureRun.cpu = true;
                }
                // Organize before adding
                const organized = organizeMeld(meld);
                this.melds.push(organized);
                this.cHand = this.cHand.filter(c => !meld.includes(c));
            });

            if (!this.hasOpened.cpu) {
                if (move.meldsToPlay.length > 0) this.hasOpened.cpu = true;
            }

            if (move.discardCard) {
                const d = move.discardCard;
                this.cHand = this.cHand.filter(c => c.id !== d.id);
                if (this.cHand.length === 0) return { winner: "CPU", score: this.pHand.length * -1 };
                this.discardPile.push(d);
            }
        } else {
            const randIdx = Math.floor(Math.random() * this.cHand.length);
            const disc = this.cHand.splice(randIdx, 1)[0];
            this.discardPile.push(disc);
        }

        this.round++;
        this.turn = 'human';
        this.phase = 'draw';
        this.resetTurnState();

        return {};
    }
}
