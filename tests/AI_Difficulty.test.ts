import { describe, it, expect } from 'vitest';
import { calculateCpuMove } from '../src/core/ai';
import { Card } from '../src/core/Card';

describe('AI Difficulty Levels', () => {

    // Helper: Create a hand where Hard and Medium strategies diverge
    // Hand: King of Hearts (10 pts) which has Synergy (Pair with King of Spades)
    //       2 of Clubs (2 pts) which is Deadwood (No synergy)
    //
    // Medium (Greedy): Should discard King because it has high value (10).
    // Hard (Synergy): Should keep King (pair), discard 2.
    const createDivergentHand = () => [
        new Card('♥', 'K', 1),  // 10 pts, part of pair
        new Card('♠', 'K', 2),  // 10 pts, part of pair
        new Card('♣', '2', 3),  // 2 pts, deadwood
        new Card('♦', '5', 4)   // 5 pts, deadwood
    ];

    it('MEDIUM should discard highest value card (Greedy)', () => {
        const hand = createDivergentHand();
        const move = calculateCpuMove(hand, true, [], 'medium');
        
        expect(move.discardCard).toBeDefined();
        // Should discard a King (Value 10)
        expect(move.discardCard!.rank).toBe('K');
    });

    it('HARD should discard lowest synergy card (Smart)', () => {
        const hand = createDivergentHand();
        const move = calculateCpuMove(hand, true, [], 'hard');
        
        expect(move.discardCard).toBeDefined();
        // Should discard the 2 or 5 (Low value, no synergy)
        // Definitely NOT the King
        expect(move.discardCard!.rank).not.toBe('K');
        expect(['2', '5']).toContain(move.discardCard!.rank);
    });

    it('EASY should limit melds to one per turn', () => {
        // Hand with two distinct valid melds
        const hand = [
            // Meld 1: 5s
            new Card('♥', '5', 1), new Card('♦', '5', 2), new Card('♣', '5', 3),
            // Meld 2: 8s
            new Card('♥', '8', 4), new Card('♦', '8', 5), new Card('♣', '8', 6),
            // Discard
            new Card('♠', 'K', 7)
        ];

        // Has Opened = true to bypass opening logic constraints
        const move = calculateCpuMove(hand, true, [], 'easy');

        // Should only play 1 meld
        expect(move.meldsToPlay.length).toBe(1);
    });

    it('HARD/MEDIUM should play all available melds', () => {
        const hand = [
            new Card('♥', '5', 1), new Card('♦', '5', 2), new Card('♣', '5', 3),
            new Card('♥', '8', 4), new Card('♦', '8', 5), new Card('♣', '8', 6),
            new Card('♠', 'K', 7)
        ];

        const move = calculateCpuMove(hand, true, [], 'hard');
        expect(move.meldsToPlay.length).toBe(2);
    });

    it('EASY should not swap jokers', () => {
        // Table: 4H, 4D, 4C, Joker
        const tableMeld = [
            new Card('♥', '4', 10),
            new Card('♦', '4', 11),
            new Card('♣', '4', 12),
            new Card('JK', 'Joker', 13) // Represents Spade
        ];
        // Hand has 4S
        const hand = [ new Card('♠', '4', 20) ];

        const move = calculateCpuMove(hand, true, [tableMeld], 'easy');
        expect(move.jokerSwaps.length).toBe(0);
    });

    it('HARD should always swap jokers', () => {
        const tableMeld = [
            new Card('♥', '4', 10),
            new Card('♦', '4', 11),
            new Card('♣', '4', 12),
            new Card('JK', 'Joker', 13)
        ];
        const hand = [ new Card('♠', '4', 20) ];

        const move = calculateCpuMove(hand, true, [tableMeld], 'hard');
        expect(move.jokerSwaps.length).toBe(1);
    });
});
