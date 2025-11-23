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
    
    // Rule: "Player checks bottom 3 cards. If he finds a Joker, he keeps it."
    public checkBottomThreeForJokers(): Card[] {
        const foundJokers: Card[] = [];
        // Look at indices 0, 1, 2 (bottom of deck)
        // We iterate backwards from 2 to 0 to splice safely
        for (let i = 2; i >= 0; i--) {
            if (i < this.cards.length) {
                if (this.cards[i].isJoker) {
                    const jokers = this.cards.splice(i, 1);
                    foundJokers.push(jokers[0]);
                }
            }
        }
        return foundJokers;
    }

    // Used when setting up the game to move bottom card out (Jolly Card)
    public removeBottom(): Card | undefined {
        return this.cards.shift();
    }

    public setCards(cards: Card[]): void {
        this.cards = cards;
    }

    public isEmpty(): boolean {
        return this.cards.length === 0;
    }
}
