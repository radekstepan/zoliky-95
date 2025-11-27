import { describe, it, expect } from 'vitest';
import { Card } from '../src/core/Card';

describe('Card Entity', () => {
    it('should return correct color', () => {
        expect(new Card('♥', 'A', 1).getColor()).toBe('red');
        expect(new Card('♦', 'A', 1).getColor()).toBe('red');
        expect(new Card('♠', 'A', 1).getColor()).toBe('black');
        expect(new Card('♣', 'A', 1).getColor()).toBe('black');
    });

    it('should return correct point values', () => {
        expect(new Card('♥', '5', 1).getValue()).toBe(5);
        expect(new Card('♥', 'K', 1).getValue()).toBe(10);
        expect(new Card('♥', 'A', 1).getValue()).toBe(10); // Default high
        expect(new Card('JK', 'Joker', 1).getValue()).toBe(0); // Dynamic
    });
});
