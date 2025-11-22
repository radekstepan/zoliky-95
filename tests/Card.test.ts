import { describe, it, expect } from 'vitest';
import { Card } from '../src/core/Card';

describe('Card Logic', () => {
    it('should correctly identify color', () => {
        const heart = new Card('♥', 'A', 1);
        const club = new Card('♣', 'A', 2);
        
        expect(heart.getColor()).toBe('red');
        expect(club.getColor()).toBe('black');
    });

    it('should return correct value for standard ranks', () => {
        const five = new Card('♥', '5', 1);
        expect(five.getValue()).toBe(5);

        const ten = new Card('♥', '10', 2);
        expect(ten.getValue()).toBe(10);
    });

    it('should return 10 for face cards', () => {
        const jack = new Card('♥', 'J', 1);
        const king = new Card('♥', 'K', 2);
        
        expect(jack.getValue()).toBe(10);
        expect(king.getValue()).toBe(10);
    });

    it('should identify Jokers', () => {
        const joker = new Card('JK', 'Joker', 99);
        expect(joker.isJoker).toBe(true);
        expect(joker.getValue()).toBe(0); // Context dependent
    });
});
