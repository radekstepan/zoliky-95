import { ICard, Rank, Suit } from "../types";

// Updated order: Red (♥), Black (♠), Red (♦), Black (♣)
export const SUITS: Suit[] = ['♥', '♠', '♦', '♣'];
export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const JOKER_SUIT: Suit = 'JK';

export class Card implements ICard {
    constructor(
        public readonly suit: Suit,
        public readonly rank: Rank,
        public readonly id: number
    ) {}

    public representation?: { rank: Rank, suit: Suit };

    get isJoker(): boolean {
        return this.suit === JOKER_SUIT;
    }

    public selected: boolean = false;

    // Static value (context-independent). 
    // Note: Run scoring now handles dynamic values separately in rules.ts
    public getValue(): number {
        if (this.isJoker) return 0; 
        if (['J', 'Q', 'K'].includes(this.rank)) return 10;
        if (this.rank === 'A') return 10; // Default high for sets/high-runs, adjusted in low-runs
        return parseInt(this.rank, 10) || 0;
    }

    public getOrder(): number {
        if (this.isJoker) return 99;
        return RANKS.indexOf(this.rank);
    }

    public getColor(): 'red' | 'black' {
        return (this.suit === '♥' || this.suit === '♦') ? 'red' : 'black';
    }
}
