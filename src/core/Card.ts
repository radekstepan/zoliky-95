import { ICard, Rank, Suit } from "../types";

export const SUITS: Suit[] = ['♥', '♦', '♣', '♠'];
export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const JOKER_SUIT: Suit = 'JK';

export class Card implements ICard {
    constructor(
        public readonly suit: Suit,
        public readonly rank: Rank,
        public readonly id: number
    ) {}

    get isJoker(): boolean {
        return this.suit === JOKER_SUIT;
    }

    public selected: boolean = false;

    public getValue(): number {
        if (this.isJoker) return 0; // Contextual, handled in rules
        if (['J', 'Q', 'K', 'A'].includes(this.rank)) return 10;
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
