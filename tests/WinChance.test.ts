import { describe, it, expect } from 'vitest';
import { evaluateHandProgress } from '../src/core/ai';
import { Card } from '../src/core/Card';

describe('Win Chance Logic', () => {
    it('should calculate 0 distance for a winning hand even before opening', () => {
        // Hand: 
        // Pure Run: 2H, 3H, 4H (3 cards)
        // Set: 5C, 5D, 5S (3 cards)
        // Set with Joker: 9C, 9D, Joker (3 cards)
        // Run with Joker: 10S, JS, Joker (3 cards)
        // Discard: King of Spades (1 card)
        // Total: 13 cards.
        // Should be able to meld 12 cards. Distance should be 1.
        // If penalty is applied wrongly, distance might be higher.

        const hand = [
            new Card('♥', '2', 1), new Card('♥', '3', 2), new Card('♥', '4', 3),
            new Card('♣', '5', 4), new Card('♦', '5', 5), new Card('♠', '5', 6),
            new Card('♣', '9', 7), new Card('♦', '9', 8), new Card('JK', 'Joker', 999),
            new Card('♠', '10', 10), new Card('♠', 'J', 11), new Card('JK', 'Joker', 998),
            new Card('♠', 'K', 13)
        ];

        // Has NOT opened yet.
        const distance = evaluateHandProgress(hand, false, []);

        // Melded: 12 cards. Hand: 13.
        // Distance should collapse to 0 because the player can open immediately and discard to win.
        expect(distance).toBe(0);
    });

    it('should prioritize melding MORE cards over HIGHER points', () => {
        // Scenario where one configuration gives high points but fewer cards,
        // and another gives low points but MORE cards (winning).

        // Example:
        // 5, 5, 5 (15 pts) vs 2, 3, 4, 5 (4 cards, 14 pts) - assuming overlapping cards
        // Actually, let's construct a case where splitting differently matters.

        // Hand: 2H, 3H, 4H, 5H, 5D, 5C
        // Option A: Run 2H-3H-4H-5H (4 cards). Left: 5D, 5C (dead).
        // Option B: Run 2H-3H-4H (3 cards) AND Set 5H, 5D, 5C (3 cards). Total 6 cards.

        // AI should pick Option B (6 cards) over Option A (4 cards), even if Option A had more points (hypothetically).

        const hand = [
            new Card('♥', '2', 1), new Card('♥', '3', 2), new Card('♥', '4', 3), new Card('♥', '5', 4),
            new Card('♦', '5', 5), new Card('♣', '5', 6)
        ];

        const distance = evaluateHandProgress(hand, true, []); // Assume opened to ignore pure run constraint for this specific check

        // Hand size 6. Should meld all 6. Distance 0.
        expect(distance).toBe(0);
    });

    it('should consider table additions when already opened', () => {
        const hand = [
            new Card('♣', '8', 101),
            new Card('♥', '8', 102),
            new Card('JK', 'Joker', 103),
            new Card('JK', 'Joker', 104)
        ];

        const table = [
            [new Card('♣', '5', 201), new Card('♣', '6', 202), new Card('♣', '7', 203)],
            [new Card('♦', '9', 204), new Card('♦', '10', 205), new Card('♦', 'J', 206)],
            [new Card('♠', '2', 207), new Card('♠', '3', 208), new Card('♠', '4', 209)]
        ];

        const distance = evaluateHandProgress(hand, true, table);

        // 8♣ and both Jokers can be laid onto table melds, leaving only 8♥ to discard.
        expect(distance).toBe(0);
    });

    it('should leverage joker swaps to reduce distance once opened', () => {
        const hand = [
            new Card('♣', '7', 301), // Swap candidate
            new Card('♣', '8', 302),
            new Card('♣', '10', 303)
        ];

        const table = [
            [
                new Card('♥', '7', 401),
                new Card('♦', '7', 402),
                new Card('♠', '7', 403),
                new Card('JK', 'Joker', 404)
            ]
        ];

        const distance = evaluateHandProgress(hand, true, table);

        // Swap 7♣ for the Joker, then meld Joker-8♣-10♣ (Joker as 9♣) to finish the hand.
        expect(distance).toBe(0);
    });
});
