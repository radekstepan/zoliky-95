import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../src/GameState';
import { Card } from '../src/core/Card';

describe('GameState Integration', () => {
    let game: GameState;

    beforeEach(() => {
        game = new GameState();
        game.initGame();
    });

    it('should initialize correctly with checks', () => {
        // Hand size might be >13 if cut Jokers found, but logic fills to 13 minimum
        // Since deck is random, we just check >= 13
        expect(game.pHand.length).toBeGreaterThanOrEqual(13);
        expect(game.cHand.length).toBe(12);
        expect(game.round).toBe(1);
    });

    it('should prevent Joker Swap on small sets', () => {
        game.round = 3;
        game.hasOpened.human = true;

        // Mock a table Set: 7H, 7D, JK
        const meld = [
            new Card('♥', '7', 1),
            new Card('♦', '7', 2),
            new Card('JK', 'Joker', 99)
        ];
        game.melds.push(meld);

        // Hand has 7S
        const myCard = new Card('♠', '7', 100);
        game.pHand.push(myCard);

        // Try to swap
        // Should fail because Set has only 2 real cards (needs 3 real cards to swap 4th)
        const res = game.attemptJokerSwap(0, myCard.id);
        expect(res.success).toBe(false);
        expect(res.msg).toContain('4 suits');
    });

    it('should allow Joker Swap on large sets (mocked)', () => {
        game.round = 3;
        game.hasOpened.human = true;

        // Mock a table Set: 7H, 7D, 7C, JK
        const meld = [
            new Card('♥', '7', 1),
            new Card('♦', '7', 2),
            new Card('♣', '7', 3),
            new Card('JK', 'Joker', 99)
        ];
        game.melds.push(meld);

        // Hand has 7S
        const myCard = new Card('♠', '7', 100);
        game.pHand.push(myCard);

        const res = game.attemptJokerSwap(0, myCard.id);
        expect(res.success).toBe(true);
    });
});
