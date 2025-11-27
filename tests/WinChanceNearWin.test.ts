import { describe, it, expect } from 'vitest';
import { evaluateHandProgress } from '../src/core/ai';
import { Card } from '../src/core/Card';

describe('Win Chance Near-Win Scenarios', () => {
    it('should recognize distance = 0 when player has 1 card left after opening', () => {
        // Hand: Just 1 card (4 of diamonds). Player has already opened.
        // This means all other cards were melded. Player can discard this and win.
        const hand = [
            new Card('♦', '4', 1)
        ];

        const distance = evaluateHandProgress(hand, true, []);

        // Distance should be 0 because player can discard and win immediately
        expect(distance).toBe(0);
    });

    it('should recognize distance = 0 when player can meld all but 1 card and has opened', () => {
        // Hand: 2♥, 3♥, 4♥, 5♦ (4 cards)
        // Can meld: 2♥-3♥-4♥ (3 cards)
        // Remaining: 1 card (5♦)
        // Since opened, can discard the 5♦ and win

        const hand = [
            new Card('♥', '2', 1), new Card('♥', '3', 2), new Card('♥', '4', 3),
            new Card('♦', '5', 4)
        ];

        const distance = evaluateHandProgress(hand, true, []);

        // Distance should be 0 (can meld 3, leaving 1 to discard)
        expect(distance).toBe(0);
    });

    it('should NOT recognize distance = 0 when player has 1 card but has not opened', () => {
        // Hand: Just 1 card. Player has NOT opened.
        // Can't win yet.
        const hand = [
            new Card('♦', '4', 1)
        ];

        const distance = evaluateHandProgress(hand, false, []);

        // Distance should be 3 (1 card unmeldable + 2 penalty for not opening)
        expect(distance).toBe(3);
    });
});
