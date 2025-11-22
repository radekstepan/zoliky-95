import { describe, it, expect } from 'vitest';
import { validateMeld, organizeMeld } from '../src/core/rules';
import { Card } from '../src/core/Card';

describe('Jolly Rules', () => {
    const c = (r: any, s: any) => new Card(s, r, Math.random());
    const joker = () => new Card('JK', 'Joker', Math.random());

    describe('Joker Adjacency', () => {
        it('should reject two adjacent jokers', () => {
            const cards = [c('5', '♦'), joker(), joker(), c('8', '♦')];
            const res = validateMeld(cards);
            expect(res.valid).toBe(false);
        });
    });

    describe('Meld Organization', () => {
        it('should organize a run with Joker at the end', () => {
            // 4, 5, Joker -> Should become 4, 5, Joker(6)
            const cards = [c('4', '♥'), c('5', '♥'), joker()];
            const org = organizeMeld(cards);
            expect(org.length).toBe(3);
            expect(org[2].isJoker).toBe(true);
            expect(org[2].representation).toEqual({ rank: '6', suit: '♥' });
        });

        it('should organize a run with Joker in the middle', () => {
            // 4, Joker, 6 -> 4, Joker(5), 6
            const cards = [c('4', '♥'), joker(), c('6', '♥')];
            const org = organizeMeld(cards);
            expect(org[1].isJoker).toBe(true);
            expect(org[1].representation).toEqual({ rank: '5', suit: '♥' });
            expect(org[0].rank).toBe('4');
            expect(org[2].rank).toBe('6');
        });

        it('should organize a run prioritizing higher points', () => {
            // Joker, 2, 3 -> 2, 3, Joker(4) (9pts)
            // (A, 2, 3 would be 6pts)
            const cards = [joker(), c('2', '♥'), c('3', '♥')];
            const org = organizeMeld(cards);
            // Sorted: 2, 3, Joker
            expect(org[0].rank).toBe('2');
            expect(org[2].isJoker).toBe(true);
            expect(org[2].representation).toEqual({ rank: '4', suit: '♥' });
        });

        it('should organize an explicit Ace Low run correctly', () => {
            // A, 2, Joker -> A, 2, 3 (Joker becomes 3)
            const cards = [c('A', '♥'), c('2', '♥'), joker()];
            const org = organizeMeld(cards);
            expect(org[0].rank).toBe('A');
            expect(org[1].rank).toBe('2');
            expect(org[2].isJoker).toBe(true);
            expect(org[2].representation).toEqual({ rank: '3', suit: '♥' });
        });

        it('should organize a set by assigning unused suits to Joker', () => {
            const cards = [c('K', '♥'), c('K', '♠'), joker()];
            const org = organizeMeld(cards);
            const j = org.find(x => x.isJoker);
            expect(j).toBeDefined();
            expect(j?.representation?.rank).toBe('K');
            const s = j?.representation?.suit;
            expect(['♣', '♦']).toContain(s);
        });
    });

    describe('Sets Validity', () => {
        it('should validate a set with unique suits', () => {
            const cards = [c('K', '♥'), c('K', '♠'), c('K', '♣')];
            expect(validateMeld(cards).valid).toBe(true);
        });

        it('should reject a set with duplicate suits', () => {
            const cards = [c('K', '♥'), c('K', '♥'), c('K', '♣')];
            expect(validateMeld(cards).valid).toBe(false);
        });
    });
    
    describe('Ace Values', () => {
        it('Ace should count as 1 in A-2-3 run', () => {
            const cards = [c('A', '♥'), c('2', '♥'), c('3', '♥')];
            const res = validateMeld(cards);
            expect(res.valid).toBe(true);
            expect(res.points).toBe(6); 
        });
        
        it('Ace should count as 10 in Q-K-A run', () => {
            const cards = [c('Q', '♥'), c('K', '♥'), c('A', '♥')];
            const res = validateMeld(cards);
            expect(res.valid).toBe(true);
            expect(res.points).toBe(30);
        });
    });
    
    describe('Straight Flush Run (Pure)', () => {
        it('should identify pure runs', () => {
            const cards = [c('5', '♦'), c('6', '♦'), c('7', '♦')];
            const res = validateMeld(cards);
            expect(res.valid).toBe(true);
            expect(res.isPure).toBe(true);
        });

        it('should mark run with Joker as impure', () => {
            const cards = [c('5', '♦'), joker(), c('7', '♦')];
            const res = validateMeld(cards);
            expect(res.valid).toBe(true);
            expect(res.isPure).toBe(false);
        });
    });
});
