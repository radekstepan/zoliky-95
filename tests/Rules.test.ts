import { describe, it, expect } from 'vitest';
import { sortHandLogic } from '../src/core/rules';
import { Card } from '../src/core/Card';

describe('Jolly Rules', () => {
    // ... (Existing tests unchanged) ...
    
    describe('Sorting Logic', () => {
        it('should sort suits in Red-Black-Red-Black order', () => {
            // Suit order: '♥', '♠', '♦', '♣'
            const hand = [
                new Card('♣', '5', 1),
                new Card('♦', '5', 2),
                new Card('♠', '5', 3),
                new Card('♥', '5', 4)
            ];
            
            sortHandLogic(hand);
            
            expect(hand[0].suit).toBe('♥');
            expect(hand[1].suit).toBe('♠');
            expect(hand[2].suit).toBe('♦');
            expect(hand[3].suit).toBe('♣');
        });
    });
});
