import { Card, RANKS, SUITS, JOKER_SUIT } from "./Card";

export class Deck {
    private cards: Card[] = [];

    constructor() {
        this.init();
    }

    public init(): void {
        this.cards = [];
        let idCounter = 0;
        // Two standard decks
        for (let d = 0; d < 2; d++) {
            for (let s of SUITS) {
                if (s === JOKER_SUIT) continue;
                for (let r of RANKS) {
                    this.cards.push(new Card(s, r, idCounter++));
                }
            }
            // 2 Jokers per deck -> Total 4 Jokers
            this.cards.push(new Card(JOKER_SUIT, 'Joker', idCounter++));
            this.cards.push(new Card(JOKER_SUIT, 'Joker', idCounter++));
        }
        this.shuffle();
    }

    public shuffle(): void {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    public draw(): Card | undefined {
        return this.cards.pop();
    }
    
    // For the "Bottom Card" rule
    public peekBottom(): Card | undefined {
        if (this.cards.length === 0) return undefined;
        return this.cards[0];
    }

    // Used when setting up the game to move bottom card out
    public removeBottom(): Card | undefined {
        return this.cards.shift();
    }

    public setCards(cards: Card[]): void {
        this.cards = cards;
    }

    public isEmpty(): boolean {
        return this.cards.length === 0;
    }
    
    public getCount(): number {
        return this.cards.length;
    }
}
