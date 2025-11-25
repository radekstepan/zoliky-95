import { describe, it, expect } from 'vitest';
import { calculateCpuMove } from '../src/core/ai';
import { Card } from '../src/core/Card';

describe('AI Logic', () => {
    it('should find a valid set in hand', () => {
        const hand = [
            new Card('♥', 'K', 1),
            new Card('♠', 'K', 2),
            new Card('♣', 'K', 3),
            new Card('♥', '2', 4)
        ];
        const move = calculateCpuMove(hand, true, []);
        expect(move.meldsToPlay.length).toBeGreaterThan(0);
    });

    it('should respect opening points constraint', () => {
        const hand = [
            new Card('♥', '2', 1),
            new Card('♠', '2', 2),
            new Card('♣', '2', 3), 
            new Card('♥', 'A', 4)
        ];
        const move = calculateCpuMove(hand, false, []);
        expect(move.meldsToPlay.length).toBe(0);
    });

    it('should calculate opening if points and pure run are sufficient', () => {
        const hand = [
            new Card('♥', 'Q', 1),
            new Card('♥', 'K', 2),
            new Card('♥', 'A', 3), // Pure Run (30pts)
            new Card('♠', '5', 4),
            new Card('♣', '5', 5),
            new Card('♦', '5', 6)  // Set (15pts) -> Total 45
        ];

        const move = calculateCpuMove(hand, false, []);
        
        expect(move.meldsToPlay.length).toBeGreaterThan(0);
        const hasRun = move.meldsToPlay.some(m => m[0].suit === m[1].suit);
        expect(hasRun).toBe(true);
    });

    it('should identify joker swap in a set', () => {
        // Table: 4H, 4D, 4C, Joker
        const tableMeld = [
            new Card('♥', '4', 10),
            new Card('♦', '4', 11),
            new Card('♣', '4', 12),
            new Card('JK', 'Joker', 13)
        ];
        // Hand: 4S
        const hand = [ new Card('♠', '4', 20) ];
        
        // Opened = true to allow swaps
        const move = calculateCpuMove(hand, true, [tableMeld]);
        
        expect(move.jokerSwaps.length).toBe(1);
        expect(move.jokerSwaps[0].handCardId).toBe(20);
    });

    it('should NOT create a set with duplicate suits', () => {
        // Hand has 2 Hearts and 1 Diamond of same rank.
        // This is strictly invalid.
        const hand = [
            new Card('♥', 'K', 1),
            new Card('♥', 'K', 2), // Duplicate suit
            new Card('♦', 'K', 3),
            new Card('♠', '2', 4)
        ];

        // Should find NO melds because K-K-K (H,H,D) is invalid
        const move = calculateCpuMove(hand, true, []);
        expect(move.meldsToPlay.length).toBe(0);
    });

    it('should find valid set if duplicate suits exist but distinct suits are available', () => {
        // Hand has H, H, D, S (all K)
        const hand = [
            new Card('♥', 'K', 1),
            new Card('♥', 'K', 2),
            new Card('♦', 'K', 3),
            new Card('♠', 'K', 4),
            new Card('♣', '2', 5)
        ];

        // Should find [H, D, S] or similar valid combo
        const move = calculateCpuMove(hand, true, []);
        expect(move.meldsToPlay.length).toBeGreaterThan(0);
        
        const meld = move.meldsToPlay[0];
        // Ensure unique suits
        const suits = new Set(meld.map(c => c.suit));
        expect(suits.size).toBe(meld.length);
    });
});
