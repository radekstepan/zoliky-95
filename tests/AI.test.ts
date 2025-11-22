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
        const move = calculateCpuMove(hand, true);
        expect(move.meldsToPlay.length).toBeGreaterThan(0);
    });

    it('should respect opening points constraint', () => {
        const hand = [
            new Card('♥', '2', 1),
            new Card('♠', '2', 2),
            new Card('♣', '2', 3), 
            new Card('♥', 'A', 4)
        ];
        const move = calculateCpuMove(hand, false);
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

        const move = calculateCpuMove(hand, false);
        
        // Now that AI scans for runs, this should succeed
        expect(move.meldsToPlay.length).toBeGreaterThan(0);
        const hasRun = move.meldsToPlay.some(m => m[0].suit === m[1].suit);
        expect(hasRun).toBe(true);
    });
});
