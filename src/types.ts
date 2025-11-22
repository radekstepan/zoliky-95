export type Suit = '♥' | '♦' | '♣' | '♠' | 'JK';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | 'Joker';

export type TurnOwner = 'human' | 'cpu';
export type TurnPhase = 'draw' | 'action';

export interface MeldResult {
    valid: boolean;
    points: number;
    type?: 'set' | 'run';
}

export interface ICard {
    readonly id: number;
    readonly suit: Suit;
    readonly rank: Rank;
    readonly isJoker: boolean;
    selected: boolean;
    
    getValue(): number;
    getOrder(): number;
    getColor(): 'red' | 'black';
}
