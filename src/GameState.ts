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
    public bottomCard: ICard | null = null;
    
    public turn: TurnOwner = 'human';
    public phase: TurnPhase = 'draw';
    public round: number = 1;
    
    public hasOpened = { human: false, cpu: false };
    public hasPureRun = { human: false, cpu: false };

    // Turn-specific
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

        // Rule: Player to right splits deck and checks for Joker (Simulated)
        // We'll give a 5% chance the CPU (Dealer's right) finds a joker and keeps it.
        // For simplicity in this version, we skip the "Keep Joker" mechanic to ensure deck consistency,
        // but we implement the Bottom Card rule.

        // Set Bottom Card
        this.bottomCard = this.deck.removeBottom() || null;

        // Rule: Dealer deals 13 to player on left (Human), 12 to others.
        // Human goes first, so Human is "Player to left of Dealer".
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

        // Game starts with Human having 13 cards. 
        // Human must discard to start the flow, essentially playing the first turn immediately.
        // Since 'draw' phase expects a draw, but human already has +1 card, 
        // we set phase to 'action' directly for round 1.
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
                // If deck empty, flip discard pile (without reshuffling per rules)
                if (this.discardPile.length > 0) {
                    // Reverse to maintain order when flipped? 
                    // Rule: "discard pile is overturned without reshuffling"
                    // Discard pile: [A, B, C] (C is top). Overturned: [C, B, A]. C becomes bottom of new deck.
                    // Code: deck.cards = discardPile.reverse()
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
        if (!result.valid) return { success: false, msg: "Invalid Meld. (Check for adjacency of Jokers, etc)" };

        // Check Discard constraint
        if (this.drawnFromDiscardId) {
            const used = selectedCards.some(c => c.id === this.drawnFromDiscardId);
            if (used) this.discardCardUsed = true;
        }

        this.melds.push(selectedCards);
        this.turnMelds.push(this.melds.length - 1);
        this.turnPoints += result.points;
        
        if (result.type === 'run' && result.isPure) {
            // This turn added a pure run.
            // Note: doesn't set permanent flag until turn confirmed
        }

        // Remove from hand
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

        // Try swapping
        const joker = meld[jokerIdx];
        meld[jokerIdx] = handCard; // Swap in temp

        // Validate new meld structure
        const res = validateMeld(meld);
        if (!res.valid) return { success: false, msg: "Card does not fit in meld." };

        // Success
        this.melds[meldIndex] = meld;
        this.pHand = this.pHand.filter(c => c.id !== handCardId);
        this.pHand.push(joker); // Give joker to player
        sortHandLogic(this.pHand);

        return { success: true };
    }

    // Victory Condition: Jolly Hand
    public attemptJollyHand(): { success: boolean; msg?: string; winner?: string } {
        // Rule: 12 cards in hand, take bottom card, lay ALL cards.
        if (this.pHand.length !== 12) return { success: false, msg: "Need exactly 12 cards for Jolly Hand." };
        if (!this.bottomCard) return { success: false, msg: "No bottom card available." };

        this.pHand.push(this.bottomCard);
        this.bottomCard = null; // Taken
        sortHandLogic(this.pHand);
        this.phase = 'action'; // Ensure phase
        
        return { success: true, msg: "Jolly Hand! You must meld ALL cards now to win." };
    }

    public cancelTurnMelds() {
        for (let i = this.turnMelds.length - 1; i >= 0; i--) {
            const idx = this.turnMelds[i];
            const cards = this.melds[idx];
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
        // 1. Check Opening constraints
        if (!this.hasOpened.human && this.turnMelds.length > 0) {
            // Check Points
            if (this.turnPoints < 36) {
                return { success: false, msg: `Opening melds must sum to 36+. Current: ${this.turnPoints}` };
            }
            // Check Pure Run
            const hasPureRun = this.turnMelds.some(idx => {
                const res = validateMeld(this.melds[idx]);
                return res.type === 'run' && res.isPure;
            });

            if (!hasPureRun) return { success: false, msg: "Opening requires at least 1 Pure Run (Straight Flush)." };

            this.hasOpened.human = true;
            this.turnMelds = []; 
        }

        // 2. Check Discard Pickup constraint
        if (this.drawnFromDiscardId && !this.discardCardUsed) {
             return { success: false, msg: "Must meld the card picked from discard pile." };
        }

        const cardIdx = this.pHand.findIndex(c => c.id === cardId);
        if (cardIdx === -1) return { success: false, msg: "Card not found" };

        const card = this.pHand.splice(cardIdx, 1)[0];
        card.selected = false;
        
        // VICTORY CHECK
        // "Game ends when someone has only one card in hand... Discard it... Win"
        // So if hand is empty NOW (after removing discard card), they win.
        if (this.pHand.length === 0) {
            // Opponents get -1 per card. 
            // If Jolly Hand (bottom card taken), opponents get -2. 
            // simplified: -1 point.
            return { success: true, winner: 'Human', score: this.cHand.length * -1 };
        }

        this.discardPile.push(card);

        // Switch Turn
        this.turn = 'cpu';
        this.phase = 'draw';
        this.resetTurnState();
        
        return { success: true };
    }

    public addToExistingMeld(meldIndex: number, selectedCards: ICard[]): { success: boolean; msg?: string; winner?: string } {
        if (!this.hasOpened.human) return { success: false, msg: "Must open before adding to melds." };
        
        const targetMeld = [...this.melds[meldIndex]];
        const candidates = [...targetMeld, ...selectedCards];

        // If it was a run, re-sort by order.
        const wasRun = validateMeld(targetMeld).type === 'run';
        if (wasRun) {
             candidates.sort((a,b) => a.getOrder() - b.getOrder());
        }

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

    public processCpuTurn(): { winner?: string, score?: number } {
        this.drawCard('stock'); 

        if (this.round >= 3) {
            const move = calculateCpuMove(this.cHand, this.hasOpened.cpu);
            
            move.meldsToPlay.forEach(meld => {
                // If opening, validate constraints
                if (!this.hasOpened.cpu) {
                    const res = validateMeld(meld);
                    if (res.type === 'run' && res.isPure) this.hasPureRun.cpu = true;
                }
                this.melds.push(meld);
                this.cHand = this.cHand.filter(c => !meld.includes(c));
            });

            // Check opening flag confirmation
            if (!this.hasOpened.cpu) {
                // Simplified: AI logic guarantees 36+ and pure run before outputting meldsToPlay
                if (move.meldsToPlay.length > 0) this.hasOpened.cpu = true;
            }

            // Discard
            if (move.discardCard) {
                const d = move.discardCard;
                this.cHand = this.cHand.filter(c => c.id !== d.id);
                // Win Check
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
